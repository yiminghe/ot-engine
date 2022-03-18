import {
  ClientResponse,
  ClientRequest,
  OTType,
  Op,
  CommitOpResponse,
  transform,
  transformType,
  last,
} from 'collaboration-engine-common';
import { Event, EventTarget } from 'ts-event-target';
import { uuid } from 'uuidv4';

export class OpEvent extends Event<'op'> {
  data: any;
  constructor() {
    super('op');
  }
}

export class Doc extends EventTarget<[OpEvent]> {
  socket: WebSocket = undefined!;
  seq = 0;

  data: any;

  version = 0;

  callMap: Map<number, Function> = new Map();

  queuedOps: Op[] = [];

  allOps: Op[] = [];

  inflightOp: Op | undefined;

  undoOps: { op: Op; invert: any }[] = [];

  constructor(
    socket: WebSocket,
    private collection: string,
    private id: string,
    private otType: OTType,
  ) {
    super();
  }

  bindToSocket(socket: WebSocket) {
    if (this.socket) {
      this.socket.close();
      this.socket.onmessage = null;
      this.socket.onopen = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
    }

    this.socket = socket;

    socket.onmessage = (event) => {
      let data;
      try {
        data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch (err) {
        return;
      }

      if (!data) return;
      this.handleResponse(data as any);
    };
  }

  send(request: ClientRequest) {
    const seq = ++this.seq;
    const promise = new Promise<ClientResponse>((resolve) => {
      this.callMap.set(seq, (arg: any) => {
        this.callMap.delete(seq);
        resolve(arg);
      });
    });
    const r: any = {
      ...request,
      seq,
    };
    this.socket.send(JSON.stringify(r));
    return promise;
  }

  handleResponse(response: ClientResponse) {
    if (response.type === 'remoteOp') {
    } else {
      const seq = response.seq;
      const resolve = this.callMap.get(seq);
      if (resolve) {
        resolve(response);
      }
    }
  }

  submitOp(op: any, invertOp: any) {
    const op2 = {
      id: uuid(),
      version: 0,
      content: op,
    };
    this.queuedOps.push(op2);
    this.undoOps.push({
      op: { ...op2 },
      invert: invertOp,
    });
  }

  async checkSend() {
    if (this.inflightOp) {
      return;
    }
    while (this.queuedOps.length) {
      const op = (this.inflightOp = this.inflightOp || this.queuedOps.shift()!);
      op.version = this.version + 1;
      const res = await this.send({
        type: 'commitOp',
        seq: 0,
        op,
      });
      if (res.payload) {
        this.handleCommitOpResponse(res as CommitOpResponse);
        this.inflightOp = undefined;
      }
    }
  }

  handleCommitOpResponse(res: CommitOpResponse) {
    if (res.payload) {
      const { otType, data } = this;
      const inflightOp = this.inflightOp!;
      const ops = res.payload!;
      this.allOps.push(...ops);
      const my: Op[] = [];
      while (last(ops).id === inflightOp.id) {
        my.push(ops.pop()!);
      }

      this.version = last(my).version;
      if (ops.length) {
        this.version = last(ops).version;
      }
      const localOps = [
        this.inflightOp!.content,
        ...this.queuedOps.map((o) => o.content),
      ];
      const newOps: any[] = transformType(localOps, ops, otType)[0];
      newOps.splice(0, my.length);
      this.queuedOps = newOps.map((content) => ({
        content,
        version: 0,
        id: uuid(),
      }));
      let l = localOps.length;
      const { undoOps } = this;
      const opForEvents: any[] = [];
      while (l) {
        --l;
        const undo = undoOps.pop()!;
        opForEvents.push(undo.invert);
        otType.applyAndInvert(data, undo.invert, false);
      }
      for (const o of ops.map((o) => o.content)) {
        opForEvents.push(o);
        otType.applyAndInvert(data, o, false);
      }
      for (const op of [...my, ...newOps]) {
        opForEvents.push(op.content);
        const invert = otType.applyAndInvert(data, op.content, true);
        undoOps.push({
          op,
          invert,
        });
      }
    }
  }

  async fetch() {
    const { otType } = this;
    const response = await this.send({
      type: 'getSnapshot',
      seq: 0,
    });
    if (response.type === 'getSnapshot') {
      if (response.payload) {
        let { snapshot, ops } = response.payload;
        this.version = snapshot.version;
        for (const p of ops) {
          this.version = p.version;
          snapshot = otType.applyAndInvert(
            snapshot.content,
            p.content,
            false,
          )[0];
        }
        this.data = snapshot;
        return snapshot;
      }
      throw new Error(response.error);
    }
    throw new Error('unexpected response:' + response.type);
  }
}
