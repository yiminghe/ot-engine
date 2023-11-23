import { Event, EventTarget } from 'ts-event-target';
import type { PubSub } from './types';

class PubSubEvent<D> extends Event<string> {
  data: D | undefined;
}

export class MemoryPubSub<D>
  extends EventTarget<[PubSubEvent<D>]>
  implements PubSub<D>
{
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
