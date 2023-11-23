import type { Duplex } from 'stream';
import {
  ClientRequest,
  ClientResponse,
  CommitOpRequest,
  DeleteDocRequest,
  GetOpsRequest,
  GetSnapshotRequest,
  Logger,
  OTError,
  OTType,
  Op,
  Presence,
  PresenceRequest,
  RemoteOpResponse,
  RollbackRequest,
  applyAndInvert,
  assertNever,
  isSameOp,
  transformType,
} from 'ot-engine-common';
import type { Server } from './Server';
import { PubSubData } from './types';

export interface AgentConfig<S, P, Pr, Custom> {
  custom?: Custom;
  stream: Duplex;
  collection: string;
  docId: string;
  clientId: string;
  otType: OTType<S, P, Pr>;
  logger?: Logger;
}

export class Agent<S, P, Pr, Custom> {
  closed = false;

  presence?: Presence<Pr>;

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

  log(...msg: any) {
    this.config.logger?.log(...msg);
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

  sendPresences() {
    this.send({
      type: 'presences',
      presences: this.server.presencesMap[this.subscribeId] || {},
    });
  }

  open() {
    const { stream, server } = this;
    this.sendPresences();
    stream.on('data', this.handleMessage);
    stream.on('close', this.clean);
    stream.on('end', this.clean);
    server.pubSub.subscribe(this.subscribeId, this.onSubscribe);
  }

  get subscribeId() {
    return `${this.collection}_${this.docId}`;
  }

  onSubscribe = (e: PubSubData<RemoteOpResponse<P> | PresenceRequest<Pr>>) => {
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
    this.log('server clean');
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

  async getSnapshotByVersion(opVersion: number) {
    const { server, otType } = this;
    const snapshotAndOps = await server.db.getSnapshot({
      ...this.agentInfo,
      version: opVersion,
      toVersion: opVersion,
    });
    if (snapshotAndOps) {
      const { content } = snapshotAndOps.snapshot;
      let { version, rollback } = snapshotAndOps.snapshot;
      let snapshot = otType.create?.(content) ?? content;
      for (const op of snapshotAndOps.ops) {
        version = op.version + 1;
        snapshot = applyAndInvert(snapshot, op.content, false, otType)[0];
        rollback = false;
      }
      snapshot = otType.deserialize?.(snapshot) ?? snapshot;
      return { content: snapshot, version, rollback };
    }
  }
  async checkAndSaveSnapshot(op: Op<P>) {
    const { server } = this;
    if (op.version % server.config.saveInterval === 0) {
      const snapshot = await this.getSnapshotByVersion(op.version);
      if (snapshot) {
        server.db.saveSnapshot({
          ...this.agentInfo,
          snapshot,
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
          if (isSameOp(ops[i], op)) {
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

  async handleRollbackMessage(request: RollbackRequest) {
    const responseInfo = {
      type: request.type,
      seq: request.seq,
    };
    const { server, agentInfo } = this;
    const snapshot = await this.getSnapshotByVersion(request.version);
    if (snapshot) {
      server.db.saveSnapshot({
        ...agentInfo,
        snapshot: {
          content: snapshot.content,
          version: 0,
          rollback: true,
        },
      });
      this.send({
        ...responseInfo,
      });
      server.broadcast(this, {
        type: 'rollback',
      });
    } else {
      throw new OTError({
        subType: 'rollback',
        detail: {},
      });
    }
  }

  async handleDeleteDocMessage(request: DeleteDocRequest) {
    const { agentInfo, server } = this;
    const { db } = server;
    const responseInfo = {
      type: request.type,
      seq: request.seq,
    };

    await db.deleteDoc({
      ...agentInfo,
    });

    this.send({
      ...responseInfo,
    });
    server.broadcast(this, {
      type: 'deleteDoc',
    });
  }

  async handleGetOpsRequest(request: GetOpsRequest) {
    const { agentInfo, server } = this;
    const { db } = server;
    const responseInfo = {
      type: request.type,
      seq: request.seq,
    };

    const ops = await db.getOps<P>({
      ...agentInfo,
      ...request,
    });

    this.send({
      ...responseInfo,
      ops,
    });
  }

  async handleGetSnapshotRequest(request: GetSnapshotRequest) {
    const { agentInfo, server } = this;
    const { db } = server;
    const responseInfo = {
      type: request.type,
      seq: request.seq,
    };

    const snapshotAndOps = await db.getSnapshot<S, P>({
      ...request,
      ...agentInfo,
    });

    this.send({
      ...responseInfo,
      snapshotAndOps,
      presences: this.server.presencesMap[this.subscribeId] || {},
    });
  }

  handleMessage = async (request: ClientRequest<P, Pr>) => {
    this.log?.('server onmessage', request);
    if (this.closed) {
      return;
    }
    const responseInfo: any = {
      type: request.type,
    };
    if ('seq' in request) {
      responseInfo.seq = request.seq;
    }
    const { server } = this;
    try {
      if (request.type === 'rollback') {
        await this.handleRollbackMessage(request);
      } else if (request.type === 'presences') {
        await this.sendPresences();
      } else if (request.type === 'deleteDoc') {
        await this.handleDeleteDocMessage(request);
      } else if (request.type === 'presence') {
        this.presence = request.presence;
        server.broadcast(this, request);
      } else if (request.type === 'getOps') {
        await this.handleGetOpsRequest(request);
      } else if (request.type === 'getSnapshot') {
        await this.handleGetSnapshotRequest(request);
      } else if (request.type === 'commitOp') {
        await this.handleCommitOpRequest(request);
      } else {
        assertNever(request);
      }
    } catch (e: unknown) {
      if (e instanceof OTError) {
        this.send({
          ...responseInfo,
          error: e.info,
        });
      } else {
        this.send({
          ...responseInfo,
          error: JSON.parse(JSON.stringify(e)),
        });
      }
    }
  };
}
