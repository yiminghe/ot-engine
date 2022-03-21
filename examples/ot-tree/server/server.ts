import http from 'http';
import express from 'express';
import { Server } from 'ot-engine-server';
import WebSocket from 'ws';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import WebSocketJSONStream from '@teamwork/websocket-json-stream';
import { type } from 'ot-tree';

const otServer = new Server({});
const collection = 'examples';
const docId = 'tree';

(async function () {
  await otServer.db.saveSnapshot({
    collection,
    docId,
    snapshot: {
      content: [
        {
          data: { name: 'root' },
          children: [],
        },
      ],
      version: 1,
    },
  });

  startServer();
})();

function startServer() {
  // Create a web server to serve files and listen to WebSocket connections
  const app = express();
  const server = http.createServer(app);

  // Connect any incoming WebSocket connection to ShareDB
  const wss = new WebSocket.Server({ server: server });
  wss.on('connection', function (ws) {
    console.log('server connect!');
    const stream = new WebSocketJSONStream(ws);
    otServer.handleStream(stream, collection, docId, type);
  });

  server.listen(8080);
  console.log('Listening on http://localhost:8080');
}
