import http from 'http';
import express from 'express';
import { Server } from 'ot-engine/server';
import WebSocket from 'ws';
import qs from 'qs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import WebSocketJSONStream from '@teamwork/websocket-json-stream';
import { type } from 'ot-tree';

const otServer = new Server();

async function initDoc(collection: string, docId: string) {
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
}

function startServer() {
  // Create a web server to serve files and listen to WebSocket connections
  const app = express();
  const server = http.createServer(app);
  const inited: Map<string, Promise<void>> = new Map();

  // Connect any incoming WebSocket
  const wss = new WebSocket.Server({ server: server });
  wss.on('connection', async function (ws, req) {
    console.log('server connect!', req.url!);
    const params: any = qs.parse(req.url!.slice(2));
    const key = `${params.collection}-${params.docId}`;
    let p = inited.get(key);
    if (!p) {
      p = initDoc(params.collection, params.docId);
      inited.set(key, p);
    }
    await p;
    const stream = new WebSocketJSONStream(ws);
    otServer.handleStream({
      stream,
      collection: params.collection,
      docId: params.docId,
      clientId: params.clientId,
      otType: type,
    });
  });

  server.listen(8080);
  console.log('Listening on http://localhost:8080');
}

startServer();
