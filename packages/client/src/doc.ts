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
  GetSnapshotResponse,
  Presence,
  isSameOp,
  Logger,
  assertNever,
  OTErrorSubType,
  OTErrorType,
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
  BeforeOpEvent,
  RollbackEvent,
  ClientRollbackParams,
} from './types';
import { UndoManager } from './UndoManager';
import { getUuid } from './utils';

interface DocConfig<S, P, Pr> {
  clientId: string;
  socket: WebSocket;
  otType: OTType<S, P, Pr>;
  undoStackLimit?: number;
  logger?: Logger;
  cacheServerOpsLimit?: number;
}

function sleep(time: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, time);
  });
}

export class Doc<S = unknown, P = unknown, Pr = unknown> extends EventTarget<
  [
    OpEvent<P>,
    BeforeOpEvent<P>,
    NoPendingEvent,
    RemoteOpEvent<P>,
    RemoteDeleteDocEvent,
    RemotePresenceEvent<Pr>,
    RollbackEvent,
  ]
> {
  socket: WebSocket;

  config: Required<DocConfig<S, P, Pr>>;

  seq = 0;

  undoManager: UndoManager<S, P, Pr>;

  remotePresence: RemotePresence<S, P, Pr>;

  localPresence: LocalPresence<S, P, Pr>;

  closed = false;

  public data: S | undefined;

  version = 1;

  callMap: Map<number, (arg: any) => void> = new Map();

  pendingOps: PendingOp<P>[] = [];

  inflightOp: PendingOp<P> | undefined;

  constructor(config: DocConfig<S, P, Pr>) {
    super();
    this.config = {
      logger: undefined!,
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

  public get presence() {
    return this.localPresence.value;
  }

  log(...msg: any[]) {
    return this.config.logger?.log(...msg);
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

  apply<T extends boolean>(op: P, invert: T): T extends true ? P : undefined {
    const ret = applyAndInvert(this.data, op, invert, this.otType);
    this.data = ret[0];
    return ret[1] as any;
  }

  fireOpEvent(ops: P[], clientIds: string[], source = false, undoRedo = false) {
    const opEvent = new OpEvent<P>(ops, clientIds, source, undoRedo);
    this.dispatchEvent(opEvent);
  }

  fireBeforeOpEvent(
    ops: P[],
    clientIds: string[],
    source = false,
    undoRedo = false,
  ) {
    const opEvent = new BeforeOpEvent<P>(ops, clientIds, source, undoRedo);
    this.dispatchEvent(opEvent);
  }

  bindToSocket(socket: WebSocket) {
    if (this.socket) {
      this.destryoy();
    }

    this.socket = socket;

    socket.onopen = () => {
      this.log('client open', Date.now());
      if (this.data) {
        this.send({
          type: 'presences',
        });
      }
    };

    socket.onmessage = (event) => {
      this.log('client onmessage', event.data);
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

  clear() {
    this.callMap.clear();
    this.localPresence.clear();
    this.remotePresence.clear();
    this.undoManager.clear();
    this.inflightOp = undefined;
    this.pendingOps = [];
  }

  destryoy() {
    const { socket } = this;
    socket.close();
    socket.onmessage = null;
    socket.onopen = null;
    socket.onerror = null;
    socket.onclose = null;
  }

  reloadPresences(presences: Record<string, Presence<Pr>>, fire = true) {
    if (this.data) {
      return this.remotePresence.reload(presences, fire);
    }
  }

  send(request: ClientRequest<P, Pr>) {
    if ('seq' in request) {
      const seq = ++this.seq;
      const promise = new Promise<ClientResponse<S, P, Pr>>(
        (resolve, reject) => {
          this.callMap.set(seq, (arg: any) => {
            this.callMap.delete(seq);
            if (arg.error) {
              const type: OTErrorType = arg.error.type;
              if (type === 'otError') {
                const subType: OTErrorSubType = arg.error.subType;
                if (subType === 'deleted') {
                  const deletedEvent = new RemoteDeleteDocEvent();
                  this.dispatchEvent(deletedEvent);
                } else if (subType === 'rollback') {
                  const rollbackEvent = new RollbackEvent();
                  this.dispatchEvent(rollbackEvent);
                }
              }
              reject(arg.error);
            } else {
              resolve(arg);
            }
          });
        },
      );
      const r: any = {
        ...request,
        seq,
      };
      this.socket.send(JSON.stringify(r));
      return promise;
    } else {
      this.socket.send(JSON.stringify(request));
    }
  }

  async handleResponse(response: ClientResponse<S, P, Pr>) {
    if ('seq' in response) {
      const seq = response.seq;
      const resolve = this.callMap.get(seq);
      if (resolve) {
        resolve(response);
      }
    } else if (response.type === 'rollback') {
      const rollbackEvent = new RollbackEvent();
      return this.dispatchEvent(rollbackEvent);
    } else if (response.type === 'deleteDoc') {
      const remoteDeleteDocEvent = new RemoteDeleteDocEvent();
      return this.dispatchEvent(remoteDeleteDocEvent);
    } else if (response.type === 'presences') {
      this.reloadPresences(response.presences);
    } else if (response.type === 'remoteOp') {
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
        const clientIds = ops.map((o) => o.clientId);
        this.fireBeforeOpEvent(opContents, clientIds, false);
        for (const o of opContents) {
          this.apply(o, false);
        }
        const remoteOpEvent = new RemoteOpEvent<P>();
        remoteOpEvent.afterOps = ops;
        this.dispatchEvent(remoteOpEvent);
        this.fireOpEvent(opContents, clientIds, false);
      }
    } else if (response.type === 'presence') {
      this.remotePresence.onPresenceResponse(response);
    } else {
      assertNever(response);
    }
  }

  get allPendingOps() {
    const p = [...this.pendingOps];
    if (this.inflightOp) {
      p.unshift(this.inflightOp);
    }
    return p;
  }

  public submitPresence(presence: Pr) {
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

  submitPendingOp(op: PendingOp<P>, undoRedo = false) {
    this.pendingOps.push(op);
    this.fireOpEvent([op.op.content], [this.clientId], true, undoRedo);
    this.checkSend();
  }

  public submitOp(opContent: P) {
    this.fireBeforeOpEvent([opContent], [this.clientId], true);
    const invert = this.apply(opContent, true);
    const { otType } = this;
    if (otType.compose) {
      const lastPendingOp = last(this.pendingOps);
      if (lastPendingOp) {
        const composed = otType.compose(lastPendingOp.op.content, opContent);
        const composedInvert = otType.compose(
          invert,
          lastPendingOp.invert.content,
        );
        if (composed && composedInvert) {
          lastPendingOp.op.content = composed;
          lastPendingOp.invert.content = composedInvert;
          return;
        }
      }
    }
    const op: Op<P> = {
      id: getUuid(),
      clientId: this.clientId,
      version: 0,
      content: opContent,
    };
    const pendingOp: PendingOp<P> = {
      op,
      invert: {
        clientId: this.clientId,
        version: 0,
        id: '-' + op.id,
        content: invert,
      },
    };
    this.undoManager.submitOp(pendingOp);
    this.submitPendingOp(pendingOp);
  }

  sending = false;

  async checkSend() {
    if (this.sending) {
      return;
    }
    this.sending = true;
    while (this.pendingOps.length) {
      const op = (this.inflightOp = this.inflightOp || this.pendingOps.shift()!)
        .op;
      op.version = this.version;
      const res = (await this.send({
        type: 'commitOp',
        seq: 0,
        op,
      })) as CommitOpResponse<P>;
      if (res.ops) {
        this.handleCommitOpResponse(res);
        this.inflightOp = undefined;
      }
      await sleep(300);
    }
    this.sending = false;
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
      let sourceIndex;
      for (sourceIndex = 0; sourceIndex < opsFromServer.length; sourceIndex++) {
        if (isSameOp(opsFromServer[sourceIndex], inflightOp.op)) {
          break;
        }
      }
      const sourceOp = opsFromServer[sourceIndex];
      if (!sourceOp) {
        throw new Error('commitOp response error!');
      }
      const prevOps = opsFromServer.slice(0, sourceIndex);
      const afterOps = opsFromServer.slice(sourceIndex + 1);
      const remoteOpEvent = new RemoteOpEvent<P>();
      remoteOpEvent.prevOps = prevOps;
      remoteOpEvent.afterOps = afterOps;
      remoteOpEvent.sourceOp = sourceOp;
      this.dispatchEvent(remoteOpEvent);
      const clientId = this.clientId;

      this.version = last(opsFromServer).version + 1;
      if (prevOps.length || afterOps.length) {
        const opForEvents: P[] = [];
        const clientIds: string[] = [];
        const prevOpsContent = prevOps.map((o) => o.content);
        const afterOpsContent = afterOps.map((o) => o.content);

        for (const pendingOp of [...localOps].reverse()) {
          opForEvents.push(pendingOp.invert.content);
          clientIds.push(clientId);
        }
        for (const o of opsFromServer) {
          const { content, clientId } = o;
          opForEvents.push(content);
          clientIds.push(clientId);
        }

        const localOpsContent = localOps.map((o) => o.op.content);
        let newPendingOps: P[] = localOpsContent;

        if (prevOps.length) {
          newPendingOps = transformType(
            newPendingOps,
            prevOpsContent,
            otType,
          )[0];
        }

        newPendingOps.shift();

        if (afterOps.length) {
          newPendingOps = transformType(
            newPendingOps,
            afterOpsContent,
            otType,
          )[0];
        }

        for (let i = 0; i < newPendingOps.length; i++) {
          pendingOps[i].op.content = newPendingOps[i];
        }

        inflightOp.op.content = sourceOp.content;
        inflightOp.op.version = sourceOp.version;

        for (const pendingOp of pendingOps) {
          const { content } = pendingOp.op;
          opForEvents.push(content);
          clientIds.push(clientId);
        }

        this.fireBeforeOpEvent(opForEvents, clientIds, false);

        for (const pendingOp of [...localOps].reverse()) {
          this.apply(pendingOp.invert.content, false);
        }

        for (const o of opsFromServer) {
          const { content } = o;
          if (isSameOp(inflightOp.op, o)) {
            inflightOp.invert.content = this.apply(content, true);
          } else {
            this.apply(content, false);
          }
        }

        for (const pendingOp of pendingOps) {
          const { content } = pendingOp.op;
          pendingOp.invert.content = this.apply(content, true);
        }

        this.fireOpEvent(opForEvents, clientIds, false);
      }
    }
  }

  public async delete() {
    await this.send({
      type: 'deleteDoc',
      seq: 0,
    });
  }

  public get remotePresences() {
    return this.remotePresence.remotePresences;
  }

  public async rollback({ version }: ClientRollbackParams) {
    await this.send({
      type: 'rollback',
      version,
      seq: 0,
    });
  }

  public async fetch() {
    this.clear();
    const { otType } = this;
    const response = (await this.send({
      type: 'getSnapshot',
      seq: 0,
    })) as GetSnapshotResponse<S, P, Pr>;
    if (response.snapshotAndOps) {
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
      this.data = content;
      if (response.presences) {
        this.reloadPresences(response.presences!, false);
      }
      return snapshot;
    }
  }
}
