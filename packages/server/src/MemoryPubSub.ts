import type { PubSub } from './types';
import { Event, EventTarget } from 'ts-event-target';

class PubSubEvent extends Event<string> {
  data: any;
  constructor(type: string) {
    super(type);
  }
}

export class MemoryPubSub extends EventTarget<[PubSubEvent]> implements PubSub {
  constructor() {
    super();
  }
  subscribe(channel: string, callback: (e: PubSubEvent) => void) {
    this.addEventListener(channel, callback);
  }
  publish(channel: string, data: any) {
    const event = new PubSubEvent(channel);
    event.data = data;
    this.dispatchEvent(event);
  }
  unsubscribe(channel: string, callback: (e: PubSubEvent) => void) {
    this.removeEventListener(channel, callback);
  }
}
