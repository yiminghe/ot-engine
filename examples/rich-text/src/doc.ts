import { Doc } from 'ot-engine/client';

import ReconnectingWebSocket from 'reconnecting-websocket';
// @ts-ignore
import { Delta, type } from 'rich-text';
import { v4 } from 'uuid';

type.invertWithDoc = (delta: any, snapshot: any) => {
  const base = new Delta(snapshot);
  return new Delta(delta).invert(base);
};

const collection = 'examples';
const docId = 'quill';
const clientId = v4(); // userId+Date.now();
// Open WebSocket connection
const socket: any = new ReconnectingWebSocket(
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host.replace(
    ':3000',
    ':8080',
  )}?collection=${collection}&docId=${docId}&clientId=${clientId}`,
);
export const doc = new Doc({
  socket,
  clientId,
  otType: type,
  logger: console,
});
