import type { DB, PubSub } from './types';
import type {
  OTType,
  PresenceIO,
  RemoteOpResponse,
  CommitOpParams,
} from 'ot-engine-common';
import { Agent } from './Agent';
import type { Duplex } from 'stream';
import { MemoryPubSub } from './MemoryPubSub';
import { MemoryDB } from './MemoryDB';

export interface ServerParams {
  saveInterval?: number;
  db?: DB;
  pubSub?: PubSub;
}

type ServerConfig = Required<ServerParams>;

export class Server {
  config: ServerConfig;

  agentsMap: Map<string, Set<Agent>> = new Map();

  constructor(config: ServerParams) {
    config = this.config = {
      saveInterval: 50,
      db: undefined!,
      pubSub: undefined!,
      ...config,
    };
    if (!config.pubSub) {
      config.pubSub = new MemoryPubSub();
    }
    if (!config.db) {
      config.db = new MemoryDB();
    }
  }

  get pubSub() {
    return this.config.pubSub;
  }

  addAgent(agent: Agent) {
    const { agentsMap } = this;
    const { subscribeId } = agent;
    let agents = agentsMap.get(subscribeId);
    if (!agents) {
      agents = new Set();
      agentsMap.set(subscribeId, agents);
    }
    agents.add(agent);
  }

  broadcast(from: Agent, message: RemoteOpResponse | PresenceIO) {
    this.pubSub.publish(from.subscribeId, message);
  }

  deleteAgent(agent: Agent) {
    const { agentsMap } = this;
    const { subscribeId } = agent;
    const agents = agentsMap.get(subscribeId)!;
    agents.delete(agent);
    if (!agents.size) {
      agentsMap.delete(subscribeId);
    }
    if (agent.clientId) {
      this.broadcast(agent, {
        type: 'presence',
        presence: {
          version: 0,
          content: null,
          clientId: agent.clientId,
        },
      });
    }
  }

  get db() {
    return this.config.db;
  }

  handleStream(
    stream: Duplex,
    collection: string,
    docId: string,
    otType: OTType,
  ) {
    const agent = new Agent(this, stream, collection, docId, otType);
    this.addAgent(agent);
    agent.open();
  }
}
