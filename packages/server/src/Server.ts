import { DB, TimeTask } from './types';
import type { OTType, RemoteOpResponse } from 'collaboration-engine-common';
import { Agent } from './Agent';
import type { Duplex } from 'stream';
import ConcurrentRunner from 'concurrent-runner';

export interface ServerParams {
  saveInterval?: number;
  db?: DB;
}

type ServerConfig = Required<ServerParams>;

function comparator(t: TimeTask, t2: TimeTask) {
  return t.time === t2.time ? 0 : t.time > t2.time ? 1 : -1;
}

export class Server {
  config: ServerConfig;

  agentsMap: Map<string, Set<Agent>> = new Map();

  runnerMap: Map<string, ConcurrentRunner<TimeTask>> = new Map();

  constructor(config: ServerParams) {
    this.config = {
      saveInterval: 50,
      db: undefined!,
      ...config,
    };
  }

  getRunnerByDocId(docId: string) {
    const { runnerMap } = this;
    let runner = runnerMap.get(docId);
    if (!runner) {
      runner = new ConcurrentRunner({
        concurrency: 1,
        comparator,
      });
      runnerMap.set(docId, runner);
    }
    return runner;
  }

  addAgent(agent: Agent) {
    const { agentsMap } = this;
    const { docId } = agent.docInfo;
    let agents = agentsMap.get(docId);
    if (!agents) {
      agents = new Set();
      agentsMap.set(docId, agents);
    }
    agents.add(agent);
  }

  broadcast(from: Agent, message: RemoteOpResponse) {
    const { docId } = from.docInfo;
    const agents = this.agentsMap.get(docId);
    if (agents) {
      for (const a of agents) {
        if (a !== from) {
          a.send(message);
        }
      }
    }
  }

  deleteAgent(agent: Agent) {
    const { agentsMap, runnerMap } = this;
    const { docId } = agent.docInfo;
    const agents = agentsMap.get(docId)!;
    agents.delete(agent);
    if (!agents.size) {
      agentsMap.delete(docId);
      runnerMap.delete(docId);
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
