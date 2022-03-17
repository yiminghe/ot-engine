import type { Duplex } from 'stream';
import type { Server } from './Server';
import { uuid } from 'uuidv4';
import type {
  OTType,
  ClientResponse,
  ClientRequest,
  CommitOpRequest,
} from 'collaboration-engine-common';
import { transform } from 'collaboration-engine-common';

export class Agent {
  clientId = uuid();

  timeId = 0;

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

  close = () => {
    this.stream.end();
  };

  clean = () => {
    this.closed = true;
    this.server.deleteAgent(this);
  };

  transform(op: any, prevOps: any[]) {
    const { otType } = this;
    if ('transforms' in otType) {
      return otType.transforms([op], prevOps, 'left');
    } else if ('transform' in otType) {
      return transform([op], prevOps, 'left', otType.transform);
    }
    throw new Error('lack transform in otType: ' + (otType as any).name);
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
      const content = this.transform(op.content, prevContent)[0];
      const newOps = [...ops];
      let baseVersion = ops[ops.length - 1].version;
      for (const c of content) {
        newOps.push({
          version: ++baseVersion,
          content: c,
        });
      }
      this.send({
        ...responseInfo,
        payload: newOps,
      });
    } else {
      this.send({
        ...responseInfo,
        payload: [op],
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
    const { docInfo, server } = this;
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
        payload: ops,
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
        payload: {
          ...snapshotAndOps,
          clientId: this.clientId,
        },
      });
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
