import { Op, Presence } from 'ot-engine-common';
import { Event } from 'ts-event-target';

export class OpEvent<P> extends Event<'op'> {
  constructor(
    public ops: P[],
    public clientIds: string[],
    public source: boolean,
    public undoRedo: boolean,
  ) {
    super('op');
  }
}

export class BeforeOpEvent<P> extends Event<'beforeOp'> {
  constructor(
    public ops: P[],
    public clientIds: string[],
    public source: boolean,
    public undoRedo: boolean,
  ) {
    super('beforeOp');
  }
}

export class RemoteOpEvent<P> extends Event<'remoteOp'> {
  prevOps?: Op<P>[];
  sourceOp?: Op<P>;
  afterOps?: Op<P>[];
  constructor() {
    super('remoteOp');
  }
}

export class RemoteDeleteDocEvent extends Event<'remoteDeleteDoc'> {
  constructor() {
    super('remoteDeleteDoc');
  }
}

export class RollbackEvent extends Event<'rollback'> {
  constructor() {
    super('rollback');
  }
}

export class RemotePresenceEvent<Pr> extends Event<'remotePresence'> {
  changed: Map<string, Pr | undefined> = new Map();
  constructor() {
    super('remotePresence');
  }
}

export class NoPendingEvent extends Event<'noPending'> {
  constructor() {
    super('noPending');
  }
}

export interface UndoItem<P> {
  op: Op<P>;
  invert: Op<P>;
}

export interface PresenceItem<P> {
  pending?: Presence<P>;
  normal?: Presence<P>;
}

export interface PendingOp<P> {
  op: Op<P>;
  invert: Op<P>;
}

export interface ClientRollbackParams {
  version: number;
}
