import type { Duplex } from 'stream';
import type { Server } from './Server';
import {
  OTType,
  ClientResponse,
  ClientRequest,
  CommitOpRequest,
  transformType,
} from 'collaboration-engine-common';

export class Agent {
  timeId = 0;

  opCount = 0;

  closed = false;

  docInfo: { docId: string; collection: string };

  data: any;

  version: number = 0;

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

  close = () => {
    this.stream.end();
  };

  clean = () => {
    this.closed = true;
    this.server.deleteAgent(this);
  };

  transform(op: any, prevOps: any[]) {
    return transformType([op], prevOps, this.otType)[0][0];
  }

  send(message: ClientResponse) {
    this.stream.write(message);
  }

  async handleCommitOpRequest(request: CommitOpRequest) {
    const responseInfo = {
      type: request.type,
      seq: request.seq,
    };
    const ops = await this.server.db.getOps({
      ...this.docInfo,
      fromVersion: request.op.version,
    });
    const { op } = request;
    if (ops.length) {
      const prevContent = ops.map((o) => o.content);
      const content = this.transform(op.content, prevContent);
      let baseVersion = ops[ops.length - 1].version;
      const newOp = {
        ...op,
        version: ++baseVersion,
        content,
      };
      this.send({
        ...responseInfo,
        ops: [...ops, newOp],
      });
      this.server.broadcast(this, {
        type: 'remoteOp',
        ops: [newOp],
      });
      this.data = this.otType.applyAndInvert(this.data, newOp, false)[0];
      this.version = newOp.version;
    } else {
      this.send({
        ...responseInfo,
        ops: [op],
      });
      this.server.broadcast(this, {
        type: 'remoteOp',
        ops: [op],
      });
      this.data = this.otType.applyAndInvert(this.data, op, false)[0];
      this.version = op.version;
    }
    if (++this.opCount % this.server.config.saveInterval === 0) {
      this.server.db.saveSnapshot({
        ...this.docInfo,
        snapshot: this.otType.serialize(this.data),
        version: this.version,
      });
    }
  }

  handleMessage = async (request: ClientRequest) => {
    if (this.closed) {
      const responseInfo = {
        type: request.type,
        seq: request.seq,
      };
      this.send({
        ...responseInfo,
        error: 'closed',
      });
      return;
    }
    const { docInfo, server, otType } = this;
    const { db } = server;
    if (request.type === 'getOps') {
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
      if (!this.data) {
        const { snapshot, ops } = snapshotAndOps;
        let data = this.otType.create(snapshot.content);
        this.version = snapshot.version;
        for (const p of ops) {
          this.version = p.version;
          data = otType.applyAndInvert(data, p.content, false)[0];
        }
        this.data = data;
      }
    } else if (request.type === 'commitOp') {
      server.getRunnerByDocId(docInfo.docId).addTask({
        time: ++this.timeId,
        run: () => {
          return {
            promise: this.handleCommitOpRequest(request),
          };
        },
      });
    }
  };
}
