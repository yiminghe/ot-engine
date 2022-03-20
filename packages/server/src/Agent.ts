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
} from 'ot-engine-common';
import { uuid } from 'uuidv4';
import { PubSubData } from './types';

export class Agent {
  agentId = uuid();

  clientId = '';

  closed = false;

  docInfo: { docId: string; collection: string };

  constructor(
    public server: Server,
    public stream: Duplex,
    collection: string,
    docId: string,
    private otType: OTType,
  ) {
    this.docInfo = {
      docId,
      collection,
    };
  }

  open() {
    const { stream } = this;
    stream.on('data', this.handleMessage);
    stream.on('close', this.clean);
    stream.on('end', this.clean);
  }

  get subscribeId() {
    return `${this.docInfo.collection}_${this.docInfo.docId}`;
  }

  subscribePubSub() {
    this.server.pubSub.subscribe(this.subscribeId, this.onSubscribe);
  }

  onSubscribe = (e: PubSubData) => {
    if (this.closed) {
      return;
    }
    const data: RemoteOpResponse = e.data;
    if (data.agentId === this.agentId) {
      return;
    }
    this.send(data);
  };

  close = () => {
    this.stream.end();
  };

  clean = () => {
    this.closed = true;
    this.server.deleteAgent(this);
    this.server.pubSub.unsubscribe(this.subscribeId, this.onSubscribe);
  };

  transform(op: any, prevOps: any[]) {
    return transformType([op], prevOps, this.otType)[0][0];
  }

  send(message: ClientResponse) {
    this.stream.write(message);
  }

  async checkAndSaveSnapshot(op: Op) {
    const { server, otType } = this;
    if (op.version % server.config.saveInterval === 0) {
      const snapshotAndOps = await server.db.getSnapshot({
        ...this.docInfo,
        version: op.version,
        toVersion: op.version,
      });
      if (snapshotAndOps) {
        const { content } = snapshotAndOps.snapshot;
        let { version } = snapshotAndOps.snapshot;
        let snapshot = otType.create?.(content) ?? content;
        for (const op of snapshotAndOps.ops) {
          version = op.version + 1;
          snapshot = applyAndInvert(snapshot, op.content, false, otType);
        }
        snapshot = otType.deserialize?.(snapshot) ?? snapshot;
        server.db.saveSnapshot({
          ...this.docInfo,
          snapshot,
          version,
        });
      }
    }
  }

  async handleCommitOpRequest(request: CommitOpRequest) {
    let ok = false;
    let sendOps: Op[] = [];
    const responseInfo = {
      type: request.type,
      seq: request.seq,
    };
    const { server, docInfo } = this;
    let newOp: Op = undefined!;
    while (!ok) {
      const ops = await server.db.getOps({
        ...docInfo,
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
          ...docInfo,
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
      agentId: this.agentId,
      ops: [newOp],
    });
    this.checkAndSaveSnapshot(newOp);
  }

  handleMessage = async (request: ClientRequest) => {
    if (this.closed) {
      return;
    }
    const { docInfo, server } = this;
    const { db } = server;
    if (request.type === 'presence') {
      server.broadcast(this, request);
    } else if (request.type === 'getOps') {
      const responseInfo = {
        type: request.type,
        seq: request.seq,
      };
      const ops = await db.getOps({
        ...request,
        ...docInfo,
      });
      this.send({
        ...responseInfo,
        ops: ops,
      });
    } else if (request.type === 'getSnapshot') {
      const responseInfo = {
        type: request.type,
        seq: request.seq,
      };
      const snapshotAndOps = await db.getSnapshot({
        ...request,
        ...docInfo,
      });
      this.send({
        ...responseInfo,
        snapshotAndOps,
      });
    } else if (request.type === 'commitOp') {
      this.handleCommitOpRequest(request);
    }
  };
}
