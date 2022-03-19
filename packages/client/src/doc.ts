import {
  ClientResponse,
  ClientRequest,
  OTType,
  Op,
  CommitOpResponse,
  transformType,
  last,
  Presence,
  transformPresence,
  applyAndInvert,
} from 'ot-engine-common';
import { Event, EventTarget } from 'ts-event-target';
import { uuid } from 'uuidv4';
import { UndoItem, OpEvent, PresenceEvent, PresenceItem } from './types';

export class Doc extends EventTarget<[OpEvent, PresenceEvent]> {
  socket: WebSocket = undefined!;
  seq = 0;

  clientId = uuid();

  data: any;

  version = 0;

  callMap: Map<number, Function> = new Map();

  pendingOps: Op[] = [];

  serverOps: Op[] = [];

  inflightOp: Op | undefined;

  undoStack: UndoItem[] = [];

  redoStack: Op[] = [];

  remotePresence: Map<string, PresenceItem> = new Map();

  localPresenceGet?: () => any;

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
    const ret = applyAndInvert(this.data, op, invert, this.otType);
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

  getOrCreatePresenceItem(clientId: string) {
    let item = this.remotePresence.get(clientId);
    if (!item) {
      item = {};
      this.remotePresence.set(clientId, item);
    }
    return item;
  }

  syncRemotePresences(ops: any[], onlyNormal = false) {
    const changed = new Map();
    for (const item of this.remotePresence.values()) {
      const { pending, normal } = item;
      if (!onlyNormal && pending) {
        const p = this.syncPresence(pending);
        if (p) {
          item.normal = p;
          item.pending = undefined;
          changed.set(p.clientId, p.content);
          continue;
        }
      }
      if (normal) {
        normal.content = transformPresence(normal.content, ops, this.otType);
        changed.set(normal.clientId, normal.content);
      }
    }
    if (changed.size) {
      const event = new PresenceEvent();
      event.changed = changed;
      this.dispatchEvent(event);
    }
  }

  handleResponse(response: ClientResponse) {
    if (response.type === 'remoteOp') {
      if (!this.inflightOp) {
        const ops = response.ops;
        this.serverOps.push(...ops);
        const opContents = ops.map((o) => o.content);
        for (const o of opContents) {
          this.apply(o, false);
        }
        this.fireOpEvent(opContents, false);
        this.syncRemotePresences(opContents);
      }
    } else if (response.type === 'presence') {
      const { presence } = response;
      if (presence.content) {
        const syncedPresence = this.syncPresence(presence);
        const item = this.getOrCreatePresenceItem(presence.clientId);
        if (syncedPresence) {
          item.pending = undefined;
          item.normal = syncedPresence;
          const event = new PresenceEvent();
          event.changed.set(presence.clientId, syncedPresence);
          this.dispatchEvent(event);
        } else {
          item.pending = presence;
        }
      } else {
        const event = new PresenceEvent();
        this.remotePresence.delete(presence.clientId);
        event.changed.set(presence.clientId, null);
        this.dispatchEvent(event);
      }
    } else {
      const seq = response.seq;
      const resolve = this.callMap.get(seq);
      if (resolve) {
        resolve(response);
      }
    }
  }

  get allPendingOps() {
    const p = [...this.pendingOps];
    if (this.inflightOp) {
      p.unshift(this.inflightOp);
    }
    return p;
  }

  submitPresence(get: () => any) {
    this.localPresenceGet = get;
    this._checkAndSubmitPresence();
  }

  _checkAndSubmitPresence() {
    if (this.localPresenceGet && !this.inflightOp && !this.pendingOps.length) {
      const presenceContent = this.localPresenceGet();
      this.localPresenceGet = undefined;
      if (presenceContent) {
        this.send({
          type: 'presence',
          presence: {
            version: this.version,
            content: presenceContent,
            clientId: this.clientId,
          },
        });
      }
    }
  }

  syncPresence(presence: Presence) {
    if (presence.version > this.version) {
      return;
    }
    let transformOps;
    if (presence.version === this.version) {
      transformOps = this.allPendingOps;
    } else {
      const { serverOps } = this;
      const l = serverOps.length;
      let i;
      for (i = l - 1; i >= 0; i--) {
        const op = serverOps[i];
        if (op.version === presence.version) {
          break;
        }
      }
      if (i < 0) {
        return;
      }
      transformOps = serverOps.slice(i).concat(this.allPendingOps);
    }
    presence.content = transformPresence(
      presence.content!,
      transformOps,
      this.otType,
    );
    return presence;
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
    this.syncRemotePresences(ops, true);
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
    this._checkAndSubmitPresence();
  }

  handleCommitOpResponse(res: CommitOpResponse) {
    if (res.ops) {
      const { otType } = this;
      const inflightOp = this.inflightOp!;
      this.inflightOp = undefined;
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
        this.fireOpEvent(opForEvents, false);
        this.syncRemotePresences(opForEvents);
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
        let { content } = snapshot;
        if (otType.create) {
          content = otType.create(content);
        }
        this.version = snapshot.version;
        for (const p of ops) {
          this.version = p.version;
          content = applyAndInvert(content, p.content, false, otType)[0];
        }
        this.data = otType.deserialize?.(content) ?? content;
        return snapshot;
      }
      throw new Error(response.error);
    }
    throw new Error('unexpected response:' + response.type);
  }
}
