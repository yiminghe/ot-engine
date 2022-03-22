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
} from 'ot-engine-common';
import { EventTarget } from 'ts-event-target';
import { PresenceManager } from './PresenceManager';
import { OpEvent, PendingOp, RemoteOpEvent, PresenceEvent } from './types';
import { UndoManager } from './UndoManager';

interface DocConfig {
  clientId: string;
  socket: WebSocket;
  otType: OTType;
  undoStackLimit?: number;
  cacheServerOpsLimit?: number;
}

export class Doc extends EventTarget<[OpEvent, RemoteOpEvent, PresenceEvent]> {
  socket: WebSocket;

  config: Required<DocConfig>;

  seq = 0;

  uid = 0;

  undoManager = new UndoManager(this);

  presenceManager = new PresenceManager(this);

  closed = false;

  data: any;

  version = 1;

  callMap: Map<number, (arg: any) => void> = new Map();

  pendingOps: PendingOp[] = [];

  inflightOp: PendingOp | undefined;

  localPresenceGet?: () => any;

  constructor(config: DocConfig) {
    super();
    this.config = {
      ...config,
      undoStackLimit: 30,
      cacheServerOpsLimit: 500,
    };
    this.bindToSocket(config.socket);
    this.socket = config.socket;
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

  fireOpEvent(ops: any[], source = false) {
    const opEvent = new OpEvent();
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

  async handleResponse(response: ClientResponse) {
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
          })) as GetOpsResponse;
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
        const remoteOpEvent = new RemoteOpEvent();
        remoteOpEvent.afterOps = ops;
        this.dispatchEvent(remoteOpEvent);
        this.fireOpEvent(opContents, false);
      }
    } else if (response.type === 'presence') {
      this.presenceManager.onPresenceResponse(response);
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

  public submitPresence(get: () => any) {
    this.localPresenceGet = get;
    this.checkAndSubmitPresence();
  }

  checkAndSubmitPresence() {
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

  submitPendingOp(op: PendingOp) {
    this.pendingOps.push(op);
    this.fireOpEvent([op.op], true);
    this.checkSend();
  }

  public submitOp(opContent: any) {
    const op: Op = {
      id: this.getUuid(),
      version: 0,
      content: opContent,
    };
    const invert = this.apply(opContent, true);
    const pendingOp: PendingOp = {
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
    this.checkAndSubmitPresence();
  }

  handleCommitOpResponse(res: CommitOpResponse) {
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
      const remoteOpEvent = new RemoteOpEvent();
      remoteOpEvent.prevOps = prevOps;
      remoteOpEvent.afterOps = afterOps;
      remoteOpEvent.myOp = my;
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

  public async fetch() {
    const { otType } = this;
    const response = await this.send({
      type: 'getSnapshot',
      seq: 0,
    });
    if (response.type === 'getSnapshot') {
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
        this.data = otType.deserialize?.(content) ?? content;
        return snapshot;
      }
      throw new Error(response.error);
    }
    throw new Error('unexpected response:' + response.type);
  }
}
