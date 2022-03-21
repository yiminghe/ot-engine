import { Doc } from 'ot-engine-client';
import { type } from 'ot-tree';
import ReconnectingWebSocket from 'reconnecting-websocket';

const collection = 'examples';
const docId = 'tree';
// Open WebSocket connection to ShareDB server
const socket: any = new ReconnectingWebSocket(
  'ws://' +
    window.location.host.replace(':3000', ':8080') +
    `?collection=${collection}}&docId=${docId}`,
);
export const doc = new Doc({
  socket,
  otType: type,
});
