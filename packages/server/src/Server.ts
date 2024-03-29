import type { Logger, NotifyResponse, Presence } from 'ot-engine-common';
import { Agent, AgentConfig } from './Agent';
import { MemoryDB } from './MemoryDB';
import { MemoryPubSub } from './MemoryPubSub';
import type { DB, PubSub } from './types';

export interface ServerConfig {
  saveInterval?: number;
  db?: DB;
  logger?: Logger;
  pubSub?: PubSub<any>;
}

export type RequiredServerConfig = Required<ServerConfig>;

export interface PresenceMessage {
  subscribeId: string;
  presence: Presence<any>;
  clientId: string;
}

export class Server {
  config: RequiredServerConfig;

  agentsMap: Map<string, Set<Agent<any, any, any, any>>> = new Map();

  presencesMap: Record<string, Record<string, Presence<any>>> = {};

  constructor(config_: ServerConfig = {}) {
    let config = config_;
    config = this.config = {
      logger: undefined!,
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

    this.pubSub.subscribe('presence', this.onPresence);
  }

  onPresence = ({ data }: { data: PresenceMessage }) => {
    this.presencesMap[data.subscribeId] ??= {};
    const docMap = this.presencesMap[data.subscribeId];
    if (data.presence.content) {
      docMap[data.clientId] = data.presence;
    } else {
      delete docMap[data.clientId];
    }
  };

  get pubSub() {
    return this.config.pubSub;
  }

  addAgent<S, P, Pr, Custom>(agent: Agent<S, P, Pr, Custom>) {
    const { agentsMap } = this;
    const { subscribeId } = agent;
    let agents = agentsMap.get(subscribeId);
    if (!agents) {
      agents = new Set();
      agentsMap.set(subscribeId, agents);
    }
    agents.add(agent);
  }

  broadcast<S, P, Pr, Custom>(
    from: Agent<S, P, Pr, Custom>,
    message: NotifyResponse<P, Pr>,
  ) {
    this.pubSub.publish(from.subscribeId, message);
    if (message.type === 'presence') {
      const msg: PresenceMessage = {
        subscribeId: from.subscribeId,
        presence: message.presence,
        clientId: message.clientId,
      };
      this.onPresence({ data: msg });
      this.pubSub.publish('presence', msg);
    }
  }

  deleteAgent<S, P, Pr, Custom>(agent: Agent<S, P, Pr, Custom>) {
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
        clientId: agent.clientId,
        presence: {
          version: 0,
          content: undefined,
        },
      });
    }
  }

  get db() {
    return this.config.db;
  }

  log(...msg: any) {
    return this.config.logger?.log(...msg);
  }

  printAgentSize() {
    for (const key of Array.from(this.agentsMap.keys())) {
      const set = this.agentsMap.get(key)!;
      this.log(`${key} agent count: ${set.size}`);
    }
  }

  public handleStream<S, P, Pr, Custom>(config: AgentConfig<S, P, Pr, Custom>) {
    const agent = new Agent(this, {
      logger: this.config.logger,
      ...config,
    });
    this.addAgent(agent);
    agent.open();
    return agent;
  }
}
