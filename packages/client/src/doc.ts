import {
  ClientResponse,
  ClientRequest,
  OTType,
  Op,
  CommitOpResponse,
  transformType,
  last,
  applyAndInvert,
  GetOpsResponse,
  DeleteDocResponse,
} from 'ot-engine-common';
import { EventTarget } from 'ts-event-target';
import { RemotePresence } from './RemotePresence';
import { LocalPresence } from './LocalPresence';
import {
  NoPendingEvent,
  OpEvent,
  PendingOp,
  RemoteOpEvent,
  RemotePresenceEvent,
  RemoteDeleteDocEvent,
} from './types';
import { UndoManager } from './UndoManager';

interface DocConfig<S, P, Pr> {
  clientId: string;
  socket: WebSocket;
  otType: OTType<S, P, Pr>;
  undoStackLimit?: number;
  cacheServerOpsLimit?: number;
}

export class Doc<S = unknown, P = unknown, Pr = unknown> extends EventTarget<
  [
    OpEvent<P>,
    NoPendingEvent,
    RemoteOpEvent<P>,
    RemoteDeleteDocEvent,
    RemotePresenceEvent<Pr>,
  ]
> {
  socket: WebSocket;

  config: Required<DocConfig<S, P, Pr>>;

  seq = 0;

  uid = 0;

  undoManager: UndoManager<S, P, Pr>;

  remotePresence: RemotePresence<S, P, Pr>;

  localPresence: LocalPresence<S, P, Pr>;

  closed = false;

  data: S | undefined;

  version = 1;

  callMap: Map<number, (arg: any) => void> = new Map();

  pendingOps: PendingOp<P>[] = [];

  inflightOp: PendingOp<P> | undefined;

  constructor(config: DocConfig<S, P, Pr>) {
    super();
    this.config = {
      ...config,
      undoStackLimit: 30,
      cacheServerOpsLimit: 500,
    };
    this.bindToSocket(config.socket);
    this.socket = config.socket;
    this.undoManager = new UndoManager<S, P, Pr>(this);
    this.remotePresence = new RemotePresence<S, P, Pr>(this);
    this.localPresence = new LocalPresence<S, P, Pr>(this);
  }

  getUuid() {
    return `${this.clientId}-${++this.uid}`;
  }

  get clientId() {
    return this.config.clientId;
  }

  get otType() {
    return this.config.otType;
  }

  public canUndo() {
    return this.undoManager.canUndo();
  }
  public canRedo() {
    return this.undoManager.canRedo();
  }
  public undo() {
    return this.undoManager.undo();
  }
  public redo() {
    return this.undoManager.redo();
  }

  apply(op: any, invert: boolean) {
    const ret = applyAndInvert(this.data, op, invert, this.otType);
    this.data = ret[0];
    return ret[1];
  }

  fireOpEvent(ops: P[], source = false) {
    const opEvent = new OpEvent<P>();
    opEvent.ops = ops;
    opEvent.source = source;
    this.dispatchEvent(opEvent);
  }

  bindToSocket(socket: WebSocket) {
    if (this.socket) {
      this.destryoy();
    }

    this.socket = socket;

    socket.onmessage = (event) => {
      console.log('client onmessage', event.data);
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

  destryoy() {
    const { socket } = this;
    socket.close();
    socket.onmessage = null;
    socket.onopen = null;
    socket.onerror = null;
    socket.onclose = null;
  }

  send(request: ClientRequest<P, Pr>) {
    const seq = ++this.seq;
    const promise = new Promise<ClientResponse<S, P, Pr>>((resolve, reject) => {
      this.callMap.set(seq, (arg: any) => {
        this.callMap.delete(seq);
        if (arg.error) {
          if (arg.error.type === 'otError' && arg.error.subType === 'deleted') {
            const deletedEvent = new RemoteDeleteDocEvent();
            this.dispatchEvent(deletedEvent);
          }
          reject(arg.error);
        } else {
          resolve(arg);
        }
      });
    });
    const r: any = {
      ...request,
      seq,
    };
    this.socket.send(JSON.stringify(r));
    return promise;
  }

  async handleResponse(response: ClientResponse<S, P, Pr>) {
    if (response.type === 'deleteDoc') {
      const res: Omit<DeleteDocResponse, 'seq'> = response;
      if (!('seq' in res)) {
        const remoteDeleteDocEvent = new RemoteDeleteDocEvent();
        return this.dispatchEvent(remoteDeleteDocEvent);
      }
    }

    if (response.type === 'remoteOp') {
      if (!this.inflightOp) {
        let ops = response.ops;
        if (this.version > last(ops)!.version) {
          return;
        }
        if (this.version !== ops[0].version) {
          const getOps = (await this.send({
            type: 'getOps',
            fromVersion: this.version,
            seq: 0,
          })) as GetOpsResponse<P>;
          if (!this.inflightOp && getOps.ops) {
            ops = getOps.ops;
          } else {
            return;
          }
        }
        this.version = last(ops)!.version + 1;
        const opContents = ops.map((o) => o.content);
        for (const o of opContents) {
          this.apply(o, false);
        }
        const remoteOpEvent = new RemoteOpEvent<P>();
        remoteOpEvent.afterOps = ops;
        this.dispatchEvent(remoteOpEvent);
        this.fireOpEvent(opContents, false);
      }
    } else if (response.type === 'presence') {
      this.remotePresence.onPresenceResponse(response);
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

  public submitPresence(presence: any) {
    this.localPresence.submit(presence);
  }

  waitNoPending() {
    return new Promise<void>((resolve) => {
      if (this.allPendingOps.length) {
        this.addEventListener('noPending', () => resolve(), {
          once: true,
        });
      } else {
        resolve();
      }
    });
  }

  submitPendingOp(op: PendingOp<P>) {
    this.pendingOps.push(op);
    this.fireOpEvent([op.op.content], true);
    this.checkSend();
  }

  public submitOp(opContent: P) {
    const op: Op<P> = {
      id: this.getUuid(),
      version: 0,
      content: opContent,
    };
    const invert = this.apply(opContent, true);
    const pendingOp: PendingOp<P> = {
      op,
      invert: {
        version: 0,
        id: '-' + op.id,
        content: invert,
      },
    };
    this.undoManager.submitOp(pendingOp);
    this.submitPendingOp(pendingOp);
  }

  async checkSend() {
    if (this.inflightOp) {
      return;
    }
    while (this.pendingOps.length) {
      const op = (this.inflightOp = this.inflightOp || this.pendingOps.shift()!)
        .op;
      op.version = this.version;
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
    const noPendingEvent = new NoPendingEvent();
    this.dispatchEvent(noPendingEvent);
  }

  handleCommitOpResponse(res: CommitOpResponse<P>) {
    if (res.ops?.length) {
      const { otType, pendingOps } = this;
      const inflightOp = this.inflightOp!;
      const localOps = this.allPendingOps;
      this.inflightOp = undefined;
      const opsFromServer = res.ops!;
      let myIndex;
      for (myIndex = 0; myIndex < opsFromServer.length; myIndex++) {
        if (opsFromServer[myIndex].id === inflightOp.op.id) {
          break;
        }
      }
      const my = opsFromServer[myIndex];
      if (!my) {
        throw new Error('commitOp response error!');
      }
      const prevOps = opsFromServer.slice(0, myIndex);
      const afterOps = opsFromServer.slice(myIndex + 1);
      const remoteOpEvent = new RemoteOpEvent<P>();
      remoteOpEvent.prevOps = prevOps;
      remoteOpEvent.afterOps = afterOps;
      remoteOpEvent.sourceOp = my;
      this.dispatchEvent(remoteOpEvent);

      this.version = last(opsFromServer).version + 1;
      if (prevOps.length || afterOps.length) {
        const opForEvents: any[] = [];

        for (const pendingOp of localOps.concat().reverse()) {
          opForEvents.push(pendingOp.invert.content);
          this.apply(pendingOp.invert.content, false);
        }

        const localOpsCongent = localOps.map((o) => o.op.content);
        let newPendingOps: any[] = localOpsCongent;

        if (prevOps.length) {
          newPendingOps = transformType(newPendingOps, prevOps, otType)[0];
        }

        newPendingOps.shift();

        if (afterOps.length) {
          newPendingOps = transformType(newPendingOps, afterOps, otType)[0];
        }

        for (let i = 0; i < newPendingOps.length; i++) {
          pendingOps[i].op.content = newPendingOps[i].content;
        }

        inflightOp.op.content = my.content;
        inflightOp.op.version = my.version;

        for (const o of opsFromServer) {
          const { content, id } = o;
          opForEvents.push(content);
          if (id === inflightOp.op.id) {
            inflightOp.invert.content = this.apply(content, true);
          } else {
            this.apply(content, false);
          }
        }

        for (const pendingOp of pendingOps) {
          const { content } = pendingOp.op;
          opForEvents.push(content);
          pendingOp.invert.content = this.apply(content, true);
        }
        this.fireOpEvent(opForEvents, false);
      }
    }
  }

  public async delete() {
    await this.send({
      type: 'deleteDoc',
      seq: 0,
    });
  }

  public async fetch() {
    const { otType } = this;
    const response = await this.send({
      type: 'getSnapshot',
      seq: 0,
    });
    if (response.type === 'getSnapshot' && response.snapshotAndOps) {
      const { snapshot, ops } = response.snapshotAndOps;
      let { content } = snapshot;
      if (otType.create) {
        content = otType.create(content);
      }
      this.version = snapshot.version;
      for (const p of ops) {
        this.version = p.version + 1;
        content = applyAndInvert(content, p.content, false, otType)[0];
      }
      this.data = otType.deserialize?.(content) ?? content;
      return snapshot;
    }
  }
}
