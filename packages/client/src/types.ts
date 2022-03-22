import { Event } from 'ts-event-target';
import { Op, Presence } from 'ot-engine-common';

export class OpEvent extends Event<'op'> {
  ops: any[] = [];
  source = false;
  constructor() {
    super('op');
  }
}

export class RemoteOpEvent extends Event<'remoteOp'> {
  prevOps?: Op[];
  myOp?: Op;
  afterOps?: Op[];
  constructor() {
    super('remoteOp');
  }
}

export class RemoteDeleteDocEvent extends Event<'remoteDeleteDoc'> {
  constructor() {
    super('remoteDeleteDoc');
  }
}

export class RemotePresenceEvent extends Event<'remotePresence'> {
  changed: Map<string, any | null> = new Map();
  constructor() {
    super('remotePresence');
  }
}

export class NoPendingEvent extends Event<'noPending'> {
  constructor() {
    super('noPending');
  }
}

export interface UndoItem {
  op: Op;
  invert: any;
}

export interface PresenceItem {
  pending?: Presence;
  normal?: Presence;
}

export interface PendingOp {
  op: Op;
  invert: Op;
}
