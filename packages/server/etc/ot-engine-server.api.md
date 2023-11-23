## API Report File for "ot-engine-server"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

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

// @public (undocumented)
export class Agent<S, P, Pr, Custom> {
    constructor(server: Server, config: AgentConfig<S, P, Pr, Custom>);
    // (undocumented)
    get agentInfo(): {
        collection: string;
        docId: string;
        custom: Custom | undefined;
    };
    // (undocumented)
    checkAndSaveSnapshot(op: Op<P>): Promise<void>;
    // (undocumented)
    clean: () => void;
    // (undocumented)
    get clientId(): string;
    // (undocumented)
    close: () => void;
    // (undocumented)
    closed: boolean;
    // (undocumented)
    get collection(): string;
    // (undocumented)
    get custom(): Custom | undefined;
    // (undocumented)
    get docId(): string;
    // (undocumented)
    getSnapshotByVersion(opVersion: number): Promise<{
        content: unknown;
        version: number;
        rollback: boolean | undefined;
    } | undefined>;
    // (undocumented)
    handleCommitOpRequest(request: CommitOpRequest<P>): Promise<void>;
    // (undocumented)
    handleDeleteDocMessage(request: DeleteDocRequest): Promise<void>;
    // (undocumented)
    handleGetOpsRequest(request: GetOpsRequest): Promise<void>;
    // (undocumented)
    handleGetSnapshotRequest(request: GetSnapshotRequest): Promise<void>;
    // (undocumented)
    handleMessage: (request: ClientRequest<P, Pr>) => Promise<void>;
    // (undocumented)
    handleRollbackMessage(request: RollbackRequest): Promise<void>;
    // (undocumented)
    log(...msg: any): void;
    // (undocumented)
    onSubscribe: (e: PubSubData<RemoteOpResponse<P> | PresenceRequest<Pr>>) => void;
    // (undocumented)
    open(): void;
    // (undocumented)
    get otType(): OTType<S, P, Pr>;
    // (undocumented)
    presence?: Presence<Pr>;
    // (undocumented)
    send(message: ClientResponse<S, P, Pr>): void;
    // (undocumented)
    sendPresences(): void;
    // (undocumented)
    server: Server;
    // (undocumented)
    get stream(): Duplex;
    // (undocumented)
    get subscribeId(): string;
    // (undocumented)
    transform(op: any, prevOps: any[]): any;
}

// @public (undocumented)
export interface AgentConfig<S, P, Pr, Custom> {
    // (undocumented)
    clientId: string;
    // (undocumented)
    collection: string;
    // (undocumented)
    custom?: Custom;
    // (undocumented)
    docId: string;
    // (undocumented)
    logger?: Logger;
    // (undocumented)
    otType: OTType<S, P, Pr>;
    // (undocumented)
    stream: Duplex;
}

// @public (undocumented)
export interface DB {
    // (undocumented)
    commitOp<P>(params: CommitOpParams<P>): Promise<void>;
    // (undocumented)
    deleteDoc(params: DeleteDocParams): Promise<void>;
    // (undocumented)
    getOps<P>(params: GetOpsParams): Promise<Op<P>[]>;
    // (undocumented)
    getSnapshot<S, P>(params: GetSnapshotParams): Promise<SnapshotAndOps<S, P> | undefined>;
    // (undocumented)
    saveSnapshot<S>(params: SaveSnapshotParams<S>): Promise<void>;
}

// @public (undocumented)
export interface PresenceMessage {
    // (undocumented)
    clientId: string;
    // (undocumented)
    presence: Presence<any>;
    // (undocumented)
    subscribeId: string;
}

// @public (undocumented)
export interface PubSub<D> {
    // (undocumented)
    publish(channel: string, data: D): void;
    // (undocumented)
    subscribe(channel: string, callback: (d: PubSubData<D>) => void): void;
    // (undocumented)
    unsubscribe(channel: string, callback: (d: PubSubData<D>) => void): void;
}

// @public (undocumented)
export interface PubSubData<D> {
    // (undocumented)
    data: D | undefined;
}

// @public (undocumented)
export type RequiredServerConfig = Required<ServerConfig>;

// @public (undocumented)
export class Server {
    constructor(config_?: ServerConfig);
    // (undocumented)
    addAgent<S, P, Pr, Custom>(agent: Agent<S, P, Pr, Custom>): void;
    // (undocumented)
    agentsMap: Map<string, Set<Agent<any, any, any, any>>>;
    // (undocumented)
    broadcast<S, P, Pr, Custom>(from: Agent<S, P, Pr, Custom>, message: NotifyResponse<P, Pr>): void;
    // (undocumented)
    config: RequiredServerConfig;
    // (undocumented)
    get db(): DB;
    // (undocumented)
    deleteAgent<S, P, Pr, Custom>(agent: Agent<S, P, Pr, Custom>): void;
    // (undocumented)
    handleStream<S, P, Pr, Custom>(config: AgentConfig<S, P, Pr, Custom>): Agent<S, P, Pr, Custom>;
    // (undocumented)
    log(...msg: any): void;
    // (undocumented)
    onPresence: ({ data }: {
        data: PresenceMessage;
    }) => void;
    // (undocumented)
    presencesMap: Record<string, Record<string, Presence<any>>>;
    // (undocumented)
    printAgentSize(): void;
    // (undocumented)
    get pubSub(): PubSub<any>;
}

// @public (undocumented)
export interface ServerConfig {
    // (undocumented)
    db?: DB;
    // (undocumented)
    logger?: Logger;
    // (undocumented)
    pubSub?: PubSub<any>;
    // (undocumented)
    saveInterval?: number;
}

// (No @packageDocumentation comment for this package)

```