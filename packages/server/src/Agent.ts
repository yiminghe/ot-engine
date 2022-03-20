import type { Duplex } from 'stream';
import type { Server } from './Server';
import {
  OTType,
  ClientResponse,
  ClientRequest,
  CommitOpRequest,
  transformType,
  Op,
  last,
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

  data: any;

  version: number = 1;

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

  async handleCommitOpRequest(request: CommitOpRequest) {
    let ok = false;
    let sendOps: Op[] = [];
    const responseInfo = {
      type: request.type,
      seq: request.seq,
    };
    const { server, otType, docInfo } = this;

    while (!ok) {
      const ops = await server.db.getOps({
        ...docInfo,
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
        sendOps = [...ops, newOp];
      } else {
        sendOps = [op];
      }
      const newOp = last(sendOps);
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

    const newOp = last(sendOps);
    this.send({
      ...responseInfo,
      ops: sendOps,
    });
    server.broadcast(this, {
      type: 'remoteOp',
      agentId: this.agentId,
      ops: [newOp],
    });
    for (const sp of sendOps) {
      if (sp.version >= this.version) {
        this.data = applyAndInvert(this.data, sp, false, otType)[0];
      }
    }
    this.version = newOp.version + 1;
    if (newOp.version % server.config.saveInterval === 0) {
      server.db.saveSnapshot({
        ...docInfo,
        snapshot: otType.serialize?.(this.data) ?? this.data,
        version: this.version,
      });
    }
  }

  handleMessage = async (request: ClientRequest) => {
    if (this.closed) {
      return;
    }
    const { docInfo, server, otType } = this;
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
      if (!this.data && snapshotAndOps) {
        const { snapshot, ops } = snapshotAndOps;
        let { content } = snapshot;
        if (otType.create) {
          content = otType.create(content);
        }
        this.version = snapshot.version;
        for (const p of ops) {
          content = applyAndInvert(content, p.content, false, otType)[0];
          this.version = p.version + 1;
        }
        this.data = otType.deserialize?.(content) ?? content;
      }
    } else if (request.type === 'commitOp') {
      this.handleCommitOpRequest(request);
    }
  };
}
