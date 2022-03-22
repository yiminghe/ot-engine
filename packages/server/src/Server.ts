import type { DB, PubSub } from './types';
import type { PresenceIO, RemoteOpResponse } from 'ot-engine-common';
import { Agent, AgentConfig } from './Agent';
import { MemoryPubSub } from './MemoryPubSub';
import { MemoryDB } from './MemoryDB';

export interface ServerConfig {
  saveInterval?: number;
  db?: DB;
  pubSub?: PubSub;
}

type ServerConfig_ = Required<ServerConfig>;

export class Server {
  config: ServerConfig_;

  agentsMap: Map<string, Set<Agent>> = new Map();

  constructor(config: ServerConfig = {}) {
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

  printAgentSize() {
    for (const key of Array.from(this.agentsMap.keys())) {
      const set = this.agentsMap.get(key)!;
      console.log(key + ' agent count: ' + set.size);
    }
  }

  public handleStream(config: AgentConfig) {
    const agent = new Agent(this, config);
    this.addAgent(agent);
    agent.open();
    this.printAgentSize();
  }
}
