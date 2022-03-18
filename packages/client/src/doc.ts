import {
  ClientResponse,
  ClientRequest,
  OTType,
  Op,
  CommitOpResponse,
  transformType,
  last,
} from 'collaboration-engine-common';
import { Event, EventTarget } from 'ts-event-target';
import { uuid } from 'uuidv4';

export class OpEvent extends Event<'op'> {
  ops: any[] = [];
  source = false;
  constructor() {
    super('op');
  }
}

interface UndoItem {
  op: Op;
  invert: any;
}

export class Doc extends EventTarget<[OpEvent]> {
  socket: WebSocket = undefined!;
  seq = 0;

  data: any;

  version = 0;

  callMap: Map<number, Function> = new Map();

  pendingOps: Op[] = [];

  serverOps: Op[] = [];

  inflightOp: Op | undefined;

  undoStack: UndoItem[] = [];

  redoStack: Op[] = [];

  constructor(socket: WebSocket, private otType: OTType) {
    super();
    this.bindToSocket(socket);
  }

  canUndo() {
    return !!this.undoStack.length;
  }

  canRedo() {
    return !!this.redoStack.length;
  }

  undo() {
    if (!this.canUndo()) {
      return;
    }
    const { undoStack, redoStack, serverOps } = this;
    let { op, invert } = undoStack.pop()!;
    redoStack.push(op);
    const allPendingOps = [this.inflightOp, ...this.pendingOps].filter(
      Boolean,
    ) as Op[];

    for (const q of allPendingOps) {
      if (q.id === op.id) {
        return this._submitOp([invert], false, false);
      }
    }
    let i;
    let l = serverOps.length - 1;
    for (i = l; i >= 0; i--) {
      const sop = serverOps[i];
      if (op.version === sop.version) {
        break;
      }
    }
    if (i < 0) {
      throw new Error('can not find server op for undo transform!');
    }
    const inverts = transformType(
      [invert],
      [...serverOps.slice(i + 1), ...allPendingOps].map((o) => o.content),
      this.otType,
    )[0];
    return this._submitOp(inverts, false, false);
  }

  redo() {
    if (!this.canRedo()) {
      return;
    }
    const op = this.redoStack.pop()!;
    const allOps = [
      ...this.serverOps,
      ...(this.inflightOp ? [this.inflightOp] : []),
      ...this.pendingOps,
    ];
    let i;
    let l = allOps.length - 1;
    for (i = l; i >= 0; i--) {
      const o = allOps[i];
      if (o.id === op.id) {
        break;
      }
    }
    if (i < 0) {
      throw new Error('can not find server op for redo transform!');
    }
    const redos = transformType(
      [op.content],
      allOps.slice(i).map((o) => o.content),
      this.otType,
    )[0];
    return this._submitOp(redos, false, false);
  }

  apply(op: any, invert: boolean) {
    const ret = this.otType.applyAndInvert(this.data, op, invert);
    this.data = ret[0];
    return ret[1];
  }

  fireOpEvent(ops: any[], source: boolean = false) {
    const opEvent = new OpEvent();
    opEvent.ops = ops;
    opEvent.source = source;
    this.dispatchEvent(opEvent);
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
      if (!this.inflightOp) {
        const ops = response.ops;
        this.serverOps.push(...ops);
        const opContent = ops.map((o) => o.content);
        for (const o of opContent) {
          this.apply(o, false);
        }
        const opEvent = new OpEvent();
        opEvent.ops = opContent;
        this.dispatchEvent(opEvent);
      }
    } else {
      const seq = response.seq;
      const resolve = this.callMap.get(seq);
      if (resolve) {
        resolve(response);
      }
    }
  }

  pushToUndoStack(undoItem: UndoItem) {
    const { undoStack, serverOps } = this;
    undoStack.push(undoItem);
    if (undoStack.length > 30) {
      undoStack.shift();
      const first = undoStack[0]!;
      let i = 0;
      for (i = 0; i < serverOps.length; i++) {
        const op = serverOps[i];
        if (op.id === first.op.id) {
          break;
        }
      }
      this.serverOps = serverOps.slice(i);
    }
  }

  _submitOp(ops: any[], clearRedo = true, inverted = true) {
    if (clearRedo) {
      this.redoStack = [];
    }

    for (const op of ops) {
      const op2: Op = {
        id: uuid(),
        createdTime: Date.now(),
        version: 0,
        content: op,
      };
      const invert = this.apply(op, inverted);
      if (inverted) {
        this.undoStack.push({
          op: { ...op2 },
          invert,
        });
      }
      this.pendingOps.push(op2);
    }

    this.fireOpEvent(ops, true);
    this.checkSend();
  }

  submitOp(op: any) {
    this._submitOp([op]);
  }

  async checkSend() {
    if (this.inflightOp) {
      return;
    }
    while (this.pendingOps.length) {
      const op = (this.inflightOp =
        this.inflightOp || this.pendingOps.shift()!);
      op.version = this.version + 1;
      const res = await this.send({
        type: 'commitOp',
        seq: 0,
        op,
      });
      if (res.type === 'commitOp' && res.ops) {
        this.handleCommitOpResponse(res);
        this.inflightOp = undefined;
      }
    }
  }

  handleCommitOpResponse(res: CommitOpResponse) {
    if (res.ops) {
      const { otType } = this;
      const inflightOp = this.inflightOp!;
      const ops = res.ops!;
      this.serverOps.push(...ops);
      const my = ops.pop()!;
      this.version = my.version;
      if (ops.length) {
        this.version = last(ops).version;
        const localOps = [
          inflightOp.content,
          ...this.pendingOps.map((o) => o.content),
        ];
        const newPendingOps: any[] = transformType(localOps, ops, otType)[0];
        newPendingOps.shift();
        for (let i = 0; i < newPendingOps.length; i++) {
          this.pendingOps[i].content = newPendingOps[i].content;
        }
        let l = localOps.length;
        const { undoStack } = this;
        const opForEvents: any[] = [];
        while (l) {
          --l;
          const undo = undoStack.pop()!;
          opForEvents.push(undo.invert);
          this.apply(undo.invert, false);
        }
        for (const o of ops.map((o) => o.content)) {
          opForEvents.push(o);
          this.apply(o, false);
        }
        inflightOp.content = my.content;
        inflightOp.version = my.version;
        for (const op of [inflightOp, ...newPendingOps]) {
          opForEvents.push(op.content);
          const invert = this.apply(op.content, true);
          undoStack.push({
            op,
            invert,
          });
        }
        const opEvent = new OpEvent();
        opEvent.ops = opForEvents;
        this.dispatchEvent(opEvent);
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
      if (response.snapshotAndOps) {
        let { snapshot, ops } = response.snapshotAndOps;
        snapshot.content = this.otType.create(snapshot.content);
        this.version = snapshot.version;
        for (const p of ops) {
          this.version = p.version;
          otType.applyAndInvert(snapshot.content, p.content, false);
        }
        this.data = snapshot.content;
        return snapshot;
      }
      throw new Error(response.error);
    }
    throw new Error('unexpected response:' + response.type);
  }
}
