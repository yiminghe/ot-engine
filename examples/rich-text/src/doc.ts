import { Doc } from 'ot-engine/client';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { type, Delta } from 'rich-text';
import { v4 } from 'uuid';
import ReconnectingWebSocket from 'reconnecting-websocket';

type.invertWithDoc = (delta: any, snapshot: any) => {
  const base = new Delta(snapshot);
  return new Delta(delta).invert(base);
};

const collection = 'examples';
const docId = 'quill';
const clientId = v4(); // userId+Date.now();
// Open WebSocket connection
const socket: any = new ReconnectingWebSocket(
  'ws://' +
    window.location.host.replace(':3000', ':8080') +
    `?collection=${collection}&docId=${docId}&clientId=${clientId}`,
);
export const doc = new Doc({
  socket,
  clientId,
  otType: type,
  logger: console,
});
