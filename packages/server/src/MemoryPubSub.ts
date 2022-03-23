import type { PubSub } from './types';
import { Event, EventTarget } from 'ts-event-target';

class PubSubEvent<D> extends Event<string> {
  data: D | undefined;
  constructor(type: string) {
    super(type);
  }
}

export class MemoryPubSub<D>
  extends EventTarget<[PubSubEvent<D>]>
  implements PubSub<D>
{
  constructor() {
    super();
  }
  subscribe(channel: string, callback: (e: PubSubEvent<D>) => void) {
    this.addEventListener(channel, callback);
  }
  publish(channel: string, data: D) {
    const event = new PubSubEvent<D>(channel);
    event.data = data;
    this.dispatchEvent(event);
  }
  unsubscribe(channel: string, callback: (e: PubSubEvent<D>) => void) {
    this.removeEventListener(channel, callback);
  }
}
