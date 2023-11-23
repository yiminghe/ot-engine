/// <reference types="node" />

import { ClientRequest } from 'ot-engine-common';
import { ClientResponse } from 'ot-engine-common';
import type { CommitOpParams } from 'ot-engine-common';
import { CommitOpRequest } from 'ot-engine-common';
import type { DeleteDocParams } from 'ot-engine-common';
import { DeleteDocRequest } from 'ot-engine-common';
import type { Duplex } from 'stream';
import type { GetOpsParams } from 'ot-engine-common';
import { GetOpsRequest } from 'ot-engine-common';
import type { GetSnapshotParams } from 'ot-engine-common';
import { GetSnapshotRequest } from 'ot-engine-common';
import { Logger } from 'ot-engine-common';
import type { NotifyResponse } from 'ot-engine-common';
import { Op } from 'ot-engine-common';
import { OTType } from 'ot-engine-common';
import { Presence } from 'ot-engine-common';
import { PresenceRequest } from 'ot-engine-common';
import { RemoteOpResponse } from 'ot-engine-common';
import { RollbackRequest } from 'ot-engine-common';
import type { SaveSnapshotParams } from 'ot-engine-common';
import type { SnapshotAndOps } from 'ot-engine-common';

export declare class Agent<S, P, Pr, Custom> {
  server: Server;
  private config;
  closed: boolean;
  presence?: Presence<Pr>;
  constructor(server: Server, config: AgentConfig<S, P, Pr, Custom>);
  get custom(): Custom | undefined;
  get docId(): string;
  get collection(): string;
  log(...msg: any): void;
  get agentInfo(): {
    collection: string;
    docId: string;
    custom: Custom | undefined;
  };
  get stream(): Duplex;
  get clientId(): string;
  get otType(): OTType<S, P, Pr>;
  sendPresences(): void;
  open(): void;
  get subscribeId(): string;
  onSubscribe: (
    e: PubSubData<RemoteOpResponse<P> | PresenceRequest<Pr>>,
  ) => void;
  close: () => void;
  clean: () => void;
  transform(op: any, prevOps: any[]): any;
  send(message: ClientResponse<S, P, Pr>): void;
  getSnapshotByVersion(opVersion: number): Promise<
    | {
        content: unknown;
        version: number;
        rollback: boolean | undefined;
      }
    | undefined
  >;
  checkAndSaveSnapshot(op: Op<P>): Promise<void>;
  handleCommitOpRequest(request: CommitOpRequest<P>): Promise<void>;
  handleRollbackMessage(request: RollbackRequest): Promise<void>;
  handleDeleteDocMessage(request: DeleteDocRequest): Promise<void>;
  handleGetOpsRequest(request: GetOpsRequest): Promise<void>;
  handleGetSnapshotRequest(request: GetSnapshotRequest): Promise<void>;
  handleMessage: (request: ClientRequest<P, Pr>) => Promise<void>;
}

export declare interface AgentConfig<S, P, Pr, Custom> {
  custom?: Custom;
  stream: Duplex;
  collection: string;
  docId: string;
  clientId: string;
  otType: OTType<S, P, Pr>;
  logger?: Logger;
}

export declare interface DB {
  getOps<P>(params: GetOpsParams): Promise<Op<P>[]>;
  getSnapshot<S, P>(
    params: GetSnapshotParams,
  ): Promise<SnapshotAndOps<S, P> | undefined>;
  commitOp<P>(params: CommitOpParams<P>): Promise<void>;
  saveSnapshot<S>(params: SaveSnapshotParams<S>): Promise<void>;
  deleteDoc(params: DeleteDocParams): Promise<void>;
}

export declare interface PresenceMessage {
  subscribeId: string;
  presence: Presence<any>;
  clientId: string;
}

export declare interface PubSub<D> {
  subscribe(channel: string, callback: (d: PubSubData<D>) => void): void;
  publish(channel: string, data: D): void;
  unsubscribe(channel: string, callback: (d: PubSubData<D>) => void): void;
}

export declare interface PubSubData<D> {
  data: D | undefined;
}

export declare type RequiredServerConfig = Required<ServerConfig>;

export declare class Server {
  config: RequiredServerConfig;
  agentsMap: Map<string, Set<Agent<any, any, any, any>>>;
  presencesMap: Record<string, Record<string, Presence<any>>>;
  constructor(config_?: ServerConfig);
  onPresence: ({ data }: { data: PresenceMessage }) => void;
  get pubSub(): PubSub<any>;
  addAgent<S, P, Pr, Custom>(agent: Agent<S, P, Pr, Custom>): void;
  broadcast<S, P, Pr, Custom>(
    from: Agent<S, P, Pr, Custom>,
    message: NotifyResponse<P, Pr>,
  ): void;
  deleteAgent<S, P, Pr, Custom>(agent: Agent<S, P, Pr, Custom>): void;
  get db(): DB;
  log(...msg: any): void;
  printAgentSize(): void;
  handleStream<S, P, Pr, Custom>(
    config: AgentConfig<S, P, Pr, Custom>,
  ): Agent<S, P, Pr, Custom>;
}

export declare interface ServerConfig {
  saveInterval?: number;
  db?: DB;
  logger?: Logger;
  pubSub?: PubSub<any>;
}

export {};
