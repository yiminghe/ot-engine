import { Doc } from 'ot-engine/client';
import { type } from 'ot-tree';
import { v4 } from 'uuid';
import ReconnectingWebSocket from 'reconnecting-websocket';

const collection = 'examples';
const docId = 'tree';
const clientId = v4(); // userId+Date.now();
// Open WebSocket connection to ShareDB server
const socket: any = new ReconnectingWebSocket(
  'ws://' +
    window.location.host.replace(':3000', ':8080') +
    `?collection=${collection}&docId=${docId}&clientId=${clientId}`,
);
export const doc = new Doc({
  socket,
  clientId,
  otType: type,
});
