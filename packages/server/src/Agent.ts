import type { Duplex } from 'stream';
import type { Server } from './Server';
import {
  OTType,
  ClientResponse,
  ClientRequest,
  CommitOpRequest,
  transformType,
  Op,
  RemoteOpResponse,
  applyAndInvert,
  OTError,
  PresenceIO,
} from 'ot-engine-common';
import { PubSubData } from './types';

export interface AgentConfig<S, P, Pr, Custom> {
  custom?: Custom;
  stream: Duplex;
  collection: string;
  docId: string;
  clientId: string;
  otType: OTType<S, P, Pr>;
}

export class Agent<S, P, Pr, Custom> {
  closed = false;

  constructor(
    public server: Server,
    private config: AgentConfig<S, P, Pr, Custom>,
  ) {}

  get custom() {
    return this.config.custom;
  }

  get docId() {
    return this.config.docId;
  }

  get collection() {
    return this.config.collection;
  }

  get agentInfo() {
    return {
      collection: this.collection,
      docId: this.docId,
      custom: this.custom,
    };
  }

  get stream() {
    return this.config.stream;
  }

  get clientId() {
    return this.config.clientId;
  }

  get otType() {
    return this.config.otType;
  }

  open() {
    const { stream, server } = this;
    stream.on('data', this.handleMessage);
    stream.on('close', this.clean);
    stream.on('end', this.clean);
    server.pubSub.subscribe(this.subscribeId, this.onSubscribe);
  }

  get subscribeId() {
    return `${this.collection}_${this.docId}`;
  }

  onSubscribe = (e: PubSubData<RemoteOpResponse<P> | PresenceIO<Pr>>) => {
    if (this.closed) {
      return;
    }
    const { data } = e;
    if (!data || data.clientId === this.clientId) {
      return;
    }
    this.send(data);
  };

  close = () => {
    this.stream.end();
  };

  clean = () => {
    console.log('server clean');
    this.closed = true;
    this.server.deleteAgent(this);
    this.server.pubSub.unsubscribe(this.subscribeId, this.onSubscribe);
  };

  transform(op: any, prevOps: any[]) {
    return transformType([op], prevOps, this.otType)[0][0];
  }

  send(message: ClientResponse<S, P, Pr>) {
    this.stream.write(message);
  }

  async checkAndSaveSnapshot(op: Op<P>) {
    const { server, otType } = this;
    if (op.version % server.config.saveInterval === 0) {
      const snapshotAndOps = await server.db.getSnapshot({
        ...this.agentInfo,
        version: op.version,
        toVersion: op.version,
      });
      if (snapshotAndOps) {
        const { content } = snapshotAndOps.snapshot;
        let { version } = snapshotAndOps.snapshot;
        let snapshot = otType.create?.(content) ?? content;
        for (const op of snapshotAndOps.ops) {
          version = op.version + 1;
          snapshot = applyAndInvert(snapshot, op.content, false, otType)[0];
        }
        snapshot = otType.deserialize?.(snapshot) ?? snapshot;
        server.db.saveSnapshot({
          ...this.agentInfo,
          snapshot: {
            content: snapshot,
            version,
          },
        });
      }
    }
  }

  async handleCommitOpRequest(request: CommitOpRequest<P>) {
    let ok = false;
    let sendOps: Op<P>[] = [];
    const responseInfo = {
      type: request.type,
      seq: request.seq,
    };
    const { server, agentInfo } = this;
    let newOp: Op<P> = undefined!;
    while (!ok) {
      const ops = await server.db.getOps<P>({
        ...agentInfo,
        fromVersion: request.op.version,
      });

      const { op } = request;
      if (ops.length) {
        let i = 0;
        for (i = 0; i < ops.length; i++) {
          if (ops[i].id === op.id) {
            newOp = ops[i];
            break;
          }
        }
        if (i === ops.length) {
          const prevContent = ops.map((o) => o.content);
          const content = this.transform(op.content, prevContent);
          let baseVersion = ops[ops.length - 1].version;
          newOp = {
            ...op,
            version: ++baseVersion,
            content,
          };
          sendOps = [...ops, newOp];
        } else {
          sendOps = ops;
        }
      } else {
        newOp = op;
        sendOps = [op];
      }
      try {
        await server.db.commitOp({
          ...agentInfo,
          op: newOp,
        });
        ok = true;
      } catch (e: unknown) {
        ok = false;
      }
    }
    this.send({
      ...responseInfo,
      ops: sendOps,
    });
    server.broadcast(this, {
      type: 'remoteOp',
      clientId: this.clientId,
      ops: [newOp],
    });
    this.checkAndSaveSnapshot(newOp);
  }

  handleMessage = async (request: ClientRequest<P, Pr>) => {
    console.log('server onmessage', request);
    if (this.closed) {
      return;
    }
    const { agentInfo, server } = this;
    const { db } = server;
    if (request.type === 'deleteDoc') {
      const responseInfo = {
        type: request.type,
        seq: request.seq,
      };
      try {
        await db.deleteDoc({
          ...agentInfo,
        });
      } catch (e: any) {
        this.send({
          ...responseInfo,
          error: (e as OTError).info,
        });
        return;
      }
      this.send({
        ...responseInfo,
      });
      server.broadcast(this, {
        type: 'deleteDoc',
      });
    } else if (request.type === 'presence') {
      server.broadcast(this, request);
    } else if (request.type === 'getOps') {
      const responseInfo = {
        type: request.type,
        seq: request.seq,
      };
      let ops;
      try {
        ops = await db.getOps<P>({
          ...agentInfo,
          ...request,
        });
      } catch (e: any) {
        this.send({
          ...responseInfo,
          error: (e as OTError).info,
        });
        return;
      }
      this.send({
        ...responseInfo,
        ops,
      });
    } else if (request.type === 'getSnapshot') {
      const responseInfo = {
        type: request.type,
        seq: request.seq,
      };
      let snapshotAndOps;
      try {
        snapshotAndOps = await db.getSnapshot<S, P>({
          ...request,
          ...agentInfo,
        });
      } catch (e: any) {
        this.send({
          ...responseInfo,
          error: (e as OTError).info,
        });
        return;
      }
      this.send({
        ...responseInfo,
        snapshotAndOps,
      });
    } else if (request.type === 'commitOp') {
      this.handleCommitOpRequest(request);
    }
  };
}
