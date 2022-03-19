import { Event, EventTarget } from 'ts-event-target';
import {
  ClientResponse,
  ClientRequest,
  OTType,
  Op,
  CommitOpResponse,
  transformType,
  last,
  Presence,
} from 'collaboration-engine-common';

export class OpEvent extends Event<'op'> {
  ops: any[] = [];
  source = false;
  constructor() {
    super('op');
  }
}

export class PresenceEvent extends Event<'presence'> {
  changed: Map<string, any | null> = new Map();
  constructor() {
    super('presence');
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
