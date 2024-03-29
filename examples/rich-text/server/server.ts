import http from 'http';
import express from 'express';
import { Server } from 'ot-engine/server';
import WebSocket from 'ws';
import qs from 'qs';

// @ts-ignore
import WebSocketJSONStream from '@teamwork/websocket-json-stream';

// @ts-ignore
import { type } from 'rich-text';

const otServer = new Server({
  logger: console,
});

async function initDoc(collection: string, docId: string) {
  await otServer.db.saveSnapshot({
    collection,
    docId,
    snapshot: {
      content: [{ insert: 'Hi!' }],
      rollback: false,
      version: 1,
    },
  });
}

const build = process.env.BUILD_MY;
const port = build ? process.env.PORT : 8080;

function startServer() {
  // Create a web server to serve files and listen to WebSocket connections
  const app = express();
  const server = http.createServer(app);
  const inited: Map<string, Promise<void>> = new Map();
  if (build) {
    app.use(express.static('build'));
  }
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
    const agent = otServer.handleStream({
      stream,
      collection: params.collection,
      docId: params.docId,
      clientId: params.clientId,
      otType: type,
    });
    if (Math.random() > 2) {
      console.log(agent);
    }
    otServer.printAgentSize();
  });

  server.listen(port);
  console.log('Listening on http://localhost:' + port);
}

startServer();
