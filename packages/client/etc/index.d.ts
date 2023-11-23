import { ClientRequest } from 'ot-engine-common';
import { ClientResponse } from 'ot-engine-common';
import { CommitOpResponse } from 'ot-engine-common';
import { Event as Event_2 } from 'ts-event-target';
import { EventTarget as EventTarget_2 } from 'ts-event-target';
import { Logger } from 'ot-engine-common';
import { Op } from 'ot-engine-common';
import { OTType } from 'ot-engine-common';
import { Presence } from 'ot-engine-common';
import { Snapshot } from 'ot-engine-common';

export declare class BeforeOpEvent<P> extends Event_2<'beforeOp'> {
  ops: P[];
  clientIds: string[];
  source: boolean;
  undoRedo: boolean;
  constructor(
    ops: P[],
    clientIds: string[],
    source: boolean,
    undoRedo: boolean,
  );
}

export declare interface ClientRollbackParams {
  version: number;
}

/**
 *@public
 */
export declare class Doc<
  S = unknown,
  P = unknown,
  Pr = unknown,
> extends EventTarget_2<
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
  seq: number;
  undoManager: UndoManager<S, P, Pr>;
  remotePresenceManager: RemotePresenceManager<S, P, Pr>;
  localPresenceManager: LocalPresenceManager<S, P, Pr>;
  closed: boolean;
  data: S | undefined;
  version: number;
  callMap: Map<number, (arg: any) => void>;
  pendingOps: PendingOp<P>[];
  inflightOp: PendingOp<P> | undefined;
  constructor(config: DocConfig<S, P, Pr>);
  get presence(): Pr | undefined;
  log(...msg: any[]): void;
  get clientId(): string;
  get otType(): OTType<S, P, Pr>;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
  apply<T extends boolean>(op: P, invert: T): T extends true ? P : undefined;
  fireOpEvent(
    ops: P[],
    clientIds: string[],
    source?: boolean,
    undoRedo?: boolean,
  ): void;
  fireBeforeOpEvent(
    ops: P[],
    clientIds: string[],
    source?: boolean,
    undoRedo?: boolean,
  ): void;
  bindToSocket(socket: WebSocket): void;
  clear(): void;
  destroy(): void;
  reloadPresences(
    presences: Record<string, Presence<Pr>>,
    fire?: boolean,
  ): Map<any, any> | undefined;
  send(
    request: ClientRequest<P, Pr>,
  ): Promise<ClientResponse<S, P, Pr>> | undefined;
  handleResponse(
    response: ClientResponse<S, P, Pr>,
  ): Promise<boolean | undefined>;
  get allPendingOps(): PendingOp<P>[];
  submitPresence(presence: Pr): void;
  waitNoPending(): Promise<void>;
  submitPendingOp(op: PendingOp<P>, undoRedo?: boolean): void;
  submitOp(opContent: P): void;
  sending: boolean;
  checkSend(): Promise<void>;
  handleCommitOpResponse(res: CommitOpResponse<P>): void;
  delete(): Promise<void>;
  get remotePresences(): Map<string, Pr | undefined>;
  rollback({ version }: ClientRollbackParams): Promise<void>;
  fetch(): Promise<Snapshot<S> | undefined>;
}

export declare interface DocConfig<S, P, Pr> {
  clientId: string;
  socket: WebSocket;
  otType: OTType<S, P, Pr>;
  undoStackLimit?: number;
  logger?: Logger;
  cacheServerOpsLimit?: number;
}

export declare class LocalPresenceManager<S, P, Pr> {
  private doc;
  value: Pr | undefined;
  sending: boolean;
  constructor(doc: Doc<S, P, Pr>);
  clear(): void;
  onOp: ({ ops, clientIds }: OpEvent<P>) => void;
  submit(value: Pr): Promise<void>;
}

export declare class NoPendingEvent extends Event_2<'noPending'> {
  constructor();
}

export declare class OpEvent<P> extends Event_2<'op'> {
  ops: P[];
  clientIds: string[];
  source: boolean;
  undoRedo: boolean;
  constructor(
    ops: P[],
    clientIds: string[],
    source: boolean,
    undoRedo: boolean,
  );
}

export declare interface PendingOp<P> {
  op: Op<P>;
  invert: Op<P>;
}

export declare interface PresenceItem<P> {
  pending?: Presence<P>;
  normal?: Presence<P>;
}

export declare class RemoteDeleteDocEvent extends Event_2<'remoteDeleteDoc'> {
  constructor();
}

export declare class RemoteOpEvent<P> extends Event_2<'remoteOp'> {
  prevOps?: Op<P>[];
  sourceOp?: Op<P>;
  afterOps?: Op<P>[];
  constructor();
}

export declare class RemotePresenceEvent<Pr> extends Event_2<'remotePresence'> {
  changed: Map<string, Pr | undefined>;
  constructor();
}

export declare class RemotePresenceManager<S, P, Pr> {
  private doc;
  remotePresenceMap: Map<string, PresenceItem<Pr>>;
  serverOps: Op<P>[];
  clear(): void;
  getOrCreatePresenceItem(clientId: string): PresenceItem<Pr>;
  constructor(doc: Doc<S, P, Pr>);
  get remotePresences(): Map<string, Pr | undefined>;
  reload(
    presences: Record<string, Presence<Pr>>,
    fire?: boolean,
  ): Map<any, any>;
  onPresenceResponse(
    response: {
      clientId: string;
      presence: Presence<Pr>;
    },
    changeSet?: Map<string, Pr | undefined>,
  ): void;
  onRemoteOp: ({ prevOps, sourceOp, afterOps }: RemoteOpEvent<P>) => void;
  syncRemotePresences(
    ops: P[],
    clientIds: string[],
    onlyNormal?: boolean,
  ): void;
  syncPresence(
    presenceClientId: string,
    presence: Presence<Pr>,
  ): Presence<Pr> | undefined;
}

export declare class RollbackEvent extends Event_2<'rollback'> {
  constructor();
}

export declare interface UndoItem<P> {
  op: Op<P>;
  invert: Op<P>;
}

export declare class UndoManager<S, P, Pr> {
  private doc;
  undoStack: UndoRedoStack<S, P, Pr>;
  redoStack: UndoRedoStack<S, P, Pr>;
  constructor(doc: Doc<S, P, Pr>);
  onRemoteOp: (e: RemoteOpEvent<P>) => void;
  submitOp(pendingOp: PendingOp<P>): void;
  clear(): void;
  get lastPendingOp(): UndoRedoItem<P>;
  canUndo(): boolean;
  canRedo(): boolean;
  undoRedo(
    popStack: UndoRedoStack<S, P, Pr>,
    pushStack: UndoRedoStack<S, P, Pr>,
  ): void;
  undo(): void;
  redo(): void;
}

export declare interface UndoRedoItem<P> {
  op: Op<P>;
  accepted: boolean;
  invert: Op<P>;
  afterOps: any[];
}

export declare class UndoRedoStack<S, P, Pr> {
  private doc;
  stack: UndoRedoItem<P>[];
  nextAcceptedIndex: number;
  constructor(doc: Doc<S, P, Pr>);
  onRemoteOp({ prevOps, sourceOp, afterOps }: RemoteOpEvent<P>): void;
  push(item: PendingOp<P>): void;
  get length(): number;
  reduceNextAcceptedIndex(): void;
  pop(): PendingOp<P> & {
    needInvert: boolean;
  };
  clear(): void;
}

export {};
