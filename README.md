# ot-engine

[![NPM version](https://badge.fury.io/js/ot-engine.png)](http://badge.fury.io/js/ot-engine)
[![NPM downloads](http://img.shields.io/npm/dm/ot-engine.svg)](https://npmjs.org/package/ot-engine)
![Build Status](https://github.com/yiminghe/ot-engine/actions/workflows/ci.yaml/badge.svg)

Operational transformation engine

## example

https://ot-engine-rich-text.herokuapp.com/

## features

- typescript full stack
- support local undo/redo
- support presence(cursors)

## ot-engine-common type definition```ts

// @public (undocumented)
export type AgentInfo = {
    custom?: any;
    docId: string;
    collection: string;
};

// @public (undocumented)
export type AgentInfoKeys = keyof AgentInfo;

// @public (undocumented)
export function applyAndInvert<S, P, Pr, I extends boolean>(snapshot: S, op: P, invert: I, otType: OTType<S, P, Pr>): I extends true ? [S, P] : [S, undefined];

// @public (undocumented)
export function assertNever(_: never): void;

// @public (undocumented)
export interface BaseRequest {
    // (undocumented)
    seq: number;
}

// @public (undocumented)
export interface BaseResponse {
    // (undocumented)
    error?: any;
    // (undocumented)
    seq: number;
}

// @public (undocumented)
export type ClientRequest<P, Pr> = RollbackRequest | PresencesRequest | DeleteDocRequest | PresenceRequest<Pr> | GetSnapshotRequest | GetOpsRequest | CommitOpRequest<P>;

// @public (undocumented)
export type ClientResponse<S, P, Pr> = NotifyResponse<P, Pr> | RollbackResponse | DeleteDocResponse | CommitOpResponse<P> | GetOpsResponse<P> | GetSnapshotResponse<S, P, Pr>;

// @public (undocumented)
export interface CommitOpParams<P> extends AgentInfo {
    // (undocumented)
    op: Op<P>;
}

// @public (undocumented)
export interface CommitOpRequest<P> extends Omit<CommitOpParams<P>, AgentInfoKeys>, BaseRequest {
    // (undocumented)
    type: 'commitOp';
}

// @public (undocumented)
export interface CommitOpResponse<P> extends BaseResponse {
    // (undocumented)
    ops?: Op<P>[];
    // (undocumented)
    type: 'commitOp';
}

// @public (undocumented)
export type DeleteDocNotification = Omit<DeleteDocResponse, 'seq'>;

// @public (undocumented)
export type DeleteDocParams = AgentInfo;

// @public (undocumented)
export interface DeleteDocRequest extends Omit<DeleteDocParams, AgentInfoKeys>, BaseRequest {
    // (undocumented)
    type: 'deleteDoc';
}

// @public (undocumented)
export interface DeleteDocResponse extends BaseResponse {
    // (undocumented)
    type: 'deleteDoc';
}

// @public (undocumented)
export interface GetOpsParams extends AgentInfo {
    // (undocumented)
    fromVersion: number;
    // (undocumented)
    toVersion?: number;
}

// @public (undocumented)
export interface GetOpsRequest extends Omit<GetOpsParams, AgentInfoKeys>, BaseRequest {
    // (undocumented)
    type: 'getOps';
}

// @public (undocumented)
export interface GetOpsResponse<P> extends BaseResponse {
    // (undocumented)
    ops?: Op<P>[];
    // (undocumented)
    type: 'getOps';
}

// @public (undocumented)
export interface GetSnapshotParams extends AgentInfo {
    // (undocumented)
    toVersion?: number;
    // (undocumented)
    version?: number;
}

// @public (undocumented)
export interface GetSnapshotRequest extends Omit<GetSnapshotParams, AgentInfoKeys>, BaseRequest {
    // (undocumented)
    type: 'getSnapshot';
}

// @public (undocumented)
export interface GetSnapshotResponse<S, P, Pr> extends BaseResponse {
    // (undocumented)
    presences?: Record<string, Presence<Pr>>;
    // (undocumented)
    snapshotAndOps?: SnapshotAndOps<S, P>;
    // (undocumented)
    type: 'getSnapshot';
}

// @public (undocumented)
export function isSameOp<P>(op: Op<P> | undefined, other: Op<P> | undefined): boolean;

// @public (undocumented)
export function last<T>(arr: T[], index?: number): T;

// @public (undocumented)
export interface Logger {
    // (undocumented)
    log: (...msg: any) => void;
}

// @public (undocumented)
export function noop(): void;

// @public (undocumented)
export type NotifyResponse<P, Pr> = RemoteOpResponse<P> | PresenceResponse<Pr> | PresencesResponse<Pr> | DeleteDocNotification | RollbackNotification;

// @public (undocumented)
export interface Op<P> {
    // (undocumented)
    clientId: string;
    // (undocumented)
    content: P;
    // (undocumented)
    id: string;
    // (undocumented)
    version: number;
}

// @public (undocumented)
export class OTError extends Error {
    constructor(info: {
        subType: OTErrorSubType;
        detail: any;
    });
    // (undocumented)
    info: {
        subType: OTErrorSubType;
        detail: any;
        type: OTErrorType;
    };
    // (undocumented)
    type: OTErrorType;
}

// @public (undocumented)
export type OTErrorSubType = 'deleted' | 'rollback';

// @public (undocumented)
export type OTErrorType = 'otError';

// @public (undocumented)
export type OTSide = 'left' | 'right';

// @public (undocumented)
export type OTType<S, P, Pr> = {
    name: string;
    create?(data: any): S;
    applyAndInvert?<I extends boolean>(snapshot: S, op: P, invert: I): I extends true ? [S, P] : [S, undefined];
    apply?(snapshot: S, op: P): S;
    invert?(op: P): P;
    invertWithDoc?(op: P, snapshot: S): P;
    compose?(op: P, prevOp: P): P | undefined;
    transform(op: P, refOp: P, side: OTSide): P;
    transformPresence?(presence: Pr, refOp: P, isOwnOp: boolean): Pr;
    serialize?(s: S): any;
    deserialize?(data: any): S;
};

// @public (undocumented)
export interface Presence<P> {
    // (undocumented)
    content?: P;
    // (undocumented)
    version: number;
}

// @public (undocumented)
export interface PresenceRequest<Pr> {
    // (undocumented)
    clientId: string;
    // (undocumented)
    presence: Presence<Pr>;
    // (undocumented)
    type: 'presence';
}

// @public (undocumented)
export type PresenceResponse<Pr> = PresenceRequest<Pr>;

// @public (undocumented)
export interface PresencesRequest {
    // (undocumented)
    type: 'presences';
}

// @public (undocumented)
export interface PresencesResponse<Pr> {
    // (undocumented)
    presences: Record<string, Presence<Pr>>;
    // (undocumented)
    type: 'presences';
}

// @public (undocumented)
export interface RemoteOpResponse<P> {
    // (undocumented)
    clientId: string;
    // (undocumented)
    ops: Op<P>[];
    // (undocumented)
    type: 'remoteOp';
}

// @public (undocumented)
export type RollbackNotification = Omit<RollbackResponse, 'seq'>;

// @public (undocumented)
export interface RollbackParams extends AgentInfo {
    // (undocumented)
    version: number;
}

// @public (undocumented)
export interface RollbackRequest extends Omit<RollbackParams, AgentInfoKeys>, BaseRequest {
    // (undocumented)
    type: 'rollback';
}

// @public (undocumented)
export interface RollbackResponse extends BaseResponse {
    // (undocumented)
    type: 'rollback';
}

// @public (undocumented)
export interface SaveSnapshotParams<S> extends AgentInfo {
    // (undocumented)
    snapshot: Snapshot<S>;
}

// @public (undocumented)
export interface Snapshot<P> {
    // (undocumented)
    content: P;
    // (undocumented)
    rollback?: boolean;
    // (undocumented)
    version: number;
}

// @public (undocumented)
export type SnapshotAndOps<S, P> = {
    snapshot: Snapshot<S>;
    ops: Op<P>[];
};

// @public (undocumented)
export function transformPresence<S, P, Pr>(presenceClientId: string, presence_: Pr, refOps: P[], clientIds: string[], otType: OTType<S, P, Pr>): Pr;

// @public (undocumented)
export function transformType<S, P, Pr>(op: P[], refOps: P[], otType: OTType<S, P, Pr>): [any[], any[]];

// (No @packageDocumentation comment for this package)

```
## ot-engine/server type definition```ts

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
## ot-engine/client type definition```ts

import { ClientRequest } from 'ot-engine-common';
import { ClientResponse } from 'ot-engine-common';
import { CommitOpResponse } from 'ot-engine-common';
import { Event as Event_2 } from 'ts-event-target';
import { EventTarget as EventTarget_2 } from 'ts-event-target';
import { Logger } from 'ot-engine-common';
import { Op } from 'ot-engine-common';
import { OTType } from 'ot-engine-common';
import { Presence } from 'ot-engine-common';
import { Snapshot } from 'ot-engine-common';

// @public (undocumented)
export class BeforeOpEvent<P> extends Event_2<'beforeOp'> {
    constructor(ops: P[], clientIds: string[], source: boolean, undoRedo: boolean);
    // (undocumented)
    clientIds: string[];
    // (undocumented)
    ops: P[];
    // (undocumented)
    source: boolean;
    // (undocumented)
    undoRedo: boolean;
}

// @public (undocumented)
export interface ClientRollbackParams {
    // (undocumented)
    version: number;
}

// @public (undocumented)
export class Doc<S = unknown, P = unknown, Pr = unknown> extends EventTarget_2<[
OpEvent<P>,
BeforeOpEvent<P>,
NoPendingEvent,
RemoteOpEvent<P>,
RemoteDeleteDocEvent,
RemotePresenceEvent<Pr>,
RollbackEvent
]> {
    constructor(config: DocConfig<S, P, Pr>);
    // (undocumented)
    get allPendingOps(): PendingOp<P>[];
    // (undocumented)
    apply<T extends boolean>(op: P, invert: T): T extends true ? P : undefined;
    // (undocumented)
    bindToSocket(socket: WebSocket): void;
    // (undocumented)
    callMap: Map<number, (arg: any) => void>;
    // (undocumented)
    canRedo(): boolean;
    // (undocumented)
    canUndo(): boolean;
    // (undocumented)
    checkSend(): Promise<void>;
    // (undocumented)
    clear(): void;
    // (undocumented)
    get clientId(): string;
    // (undocumented)
    closed: boolean;
    // (undocumented)
    config: Required<DocConfig<S, P, Pr>>;
    // (undocumented)
    data: S | undefined;
    // (undocumented)
    delete(): Promise<void>;
    // (undocumented)
    destroy(): void;
    // (undocumented)
    fetch(): Promise<Snapshot<S> | undefined>;
    // (undocumented)
    fireBeforeOpEvent(ops: P[], clientIds: string[], source?: boolean, undoRedo?: boolean): void;
    // (undocumented)
    fireOpEvent(ops: P[], clientIds: string[], source?: boolean, undoRedo?: boolean): void;
    // (undocumented)
    handleCommitOpResponse(res: CommitOpResponse<P>): void;
    // (undocumented)
    handleResponse(response: ClientResponse<S, P, Pr>): Promise<boolean | undefined>;
    // (undocumented)
    inflightOp: PendingOp<P> | undefined;
    // (undocumented)
    localPresenceManager: LocalPresenceManager<S, P, Pr>;
    // (undocumented)
    log(...msg: any[]): void;
    // (undocumented)
    get otType(): OTType<S, P, Pr>;
    // (undocumented)
    pendingOps: PendingOp<P>[];
    // (undocumented)
    get presence(): Pr | undefined;
    // (undocumented)
    redo(): void;
    // (undocumented)
    reloadPresences(presences: Record<string, Presence<Pr>>, fire?: boolean): Map<any, any> | undefined;
    // (undocumented)
    remotePresenceManager: RemotePresenceManager<S, P, Pr>;
    // (undocumented)
    get remotePresences(): Map<string, Pr | undefined>;
    // (undocumented)
    rollback({ version }: ClientRollbackParams): Promise<void>;
    // (undocumented)
    send(request: ClientRequest<P, Pr>): Promise<ClientResponse<S, P, Pr>> | undefined;
    // (undocumented)
    sending: boolean;
    // (undocumented)
    seq: number;
    // (undocumented)
    socket: WebSocket;
    // (undocumented)
    submitOp(opContent: P): void;
    // (undocumented)
    submitPendingOp(op: PendingOp<P>, undoRedo?: boolean): void;
    // (undocumented)
    submitPresence(presence: Pr): void;
    // (undocumented)
    undo(): void;
    // (undocumented)
    undoManager: UndoManager<S, P, Pr>;
    // (undocumented)
    version: number;
    // (undocumented)
    waitNoPending(): Promise<void>;
}

// @public (undocumented)
export interface DocConfig<S, P, Pr> {
    // (undocumented)
    cacheServerOpsLimit?: number;
    // (undocumented)
    clientId: string;
    // (undocumented)
    logger?: Logger;
    // (undocumented)
    otType: OTType<S, P, Pr>;
    // (undocumented)
    socket: WebSocket;
    // (undocumented)
    undoStackLimit?: number;
}

// @public (undocumented)
export class LocalPresenceManager<S, P, Pr> {
    constructor(doc: Doc<S, P, Pr>);
    // (undocumented)
    clear(): void;
    // (undocumented)
    onOp: ({ ops, clientIds }: OpEvent<P>) => void;
    // (undocumented)
    sending: boolean;
    // (undocumented)
    submit(value: Pr): Promise<void>;
    // (undocumented)
    value: Pr | undefined;
}

// @public (undocumented)
export class NoPendingEvent extends Event_2<'noPending'> {
    constructor();
}

// @public (undocumented)
export class OpEvent<P> extends Event_2<'op'> {
    constructor(ops: P[], clientIds: string[], source: boolean, undoRedo: boolean);
    // (undocumented)
    clientIds: string[];
    // (undocumented)
    ops: P[];
    // (undocumented)
    source: boolean;
    // (undocumented)
    undoRedo: boolean;
}

// @public (undocumented)
export interface PendingOp<P> {
    // (undocumented)
    invert: Op<P>;
    // (undocumented)
    op: Op<P>;
}

// @public (undocumented)
export interface PresenceItem<P> {
    // (undocumented)
    normal?: Presence<P>;
    // (undocumented)
    pending?: Presence<P>;
}

// @public (undocumented)
export class RemoteDeleteDocEvent extends Event_2<'remoteDeleteDoc'> {
    constructor();
}

// @public (undocumented)
export class RemoteOpEvent<P> extends Event_2<'remoteOp'> {
    constructor();
    // (undocumented)
    afterOps?: Op<P>[];
    // (undocumented)
    prevOps?: Op<P>[];
    // (undocumented)
    sourceOp?: Op<P>;
}

// @public (undocumented)
export class RemotePresenceEvent<Pr> extends Event_2<'remotePresence'> {
    constructor();
    // (undocumented)
    changed: Map<string, Pr | undefined>;
}

// @public (undocumented)
export class RemotePresenceManager<S, P, Pr> {
    constructor(doc: Doc<S, P, Pr>);
    // (undocumented)
    clear(): void;
    // (undocumented)
    getOrCreatePresenceItem(clientId: string): PresenceItem<Pr>;
    // (undocumented)
    onPresenceResponse(response: {
        clientId: string;
        presence: Presence<Pr>;
    }, changeSet?: Map<string, Pr | undefined>): void;
    // (undocumented)
    onRemoteOp: ({ prevOps, sourceOp, afterOps }: RemoteOpEvent<P>) => void;
    // (undocumented)
    reload(presences: Record<string, Presence<Pr>>, fire?: boolean): Map<any, any>;
    // (undocumented)
    remotePresenceMap: Map<string, PresenceItem<Pr>>;
    // (undocumented)
    get remotePresences(): Map<string, Pr | undefined>;
    // (undocumented)
    serverOps: Op<P>[];
    // (undocumented)
    syncPresence(presenceClientId: string, presence: Presence<Pr>): Presence<Pr> | undefined;
    // (undocumented)
    syncRemotePresences(ops: P[], clientIds: string[], onlyNormal?: boolean): void;
}

// @public (undocumented)
export class RollbackEvent extends Event_2<'rollback'> {
    constructor();
}

// @public (undocumented)
export interface UndoItem<P> {
    // (undocumented)
    invert: Op<P>;
    // (undocumented)
    op: Op<P>;
}

// @public (undocumented)
export class UndoManager<S, P, Pr> {
    constructor(doc: Doc<S, P, Pr>);
    // (undocumented)
    canRedo(): boolean;
    // (undocumented)
    canUndo(): boolean;
    // (undocumented)
    clear(): void;
    // (undocumented)
    get lastPendingOp(): UndoRedoItem<P>;
    // (undocumented)
    onRemoteOp: (e: RemoteOpEvent<P>) => void;
    // (undocumented)
    redo(): void;
    // (undocumented)
    redoStack: UndoRedoStack<S, P, Pr>;
    // (undocumented)
    submitOp(pendingOp: PendingOp<P>): void;
    // (undocumented)
    undo(): void;
    // (undocumented)
    undoRedo(popStack: UndoRedoStack<S, P, Pr>, pushStack: UndoRedoStack<S, P, Pr>): void;
    // (undocumented)
    undoStack: UndoRedoStack<S, P, Pr>;
}

// @public (undocumented)
export interface UndoRedoItem<P> {
    // (undocumented)
    accepted: boolean;
    // (undocumented)
    afterOps: any[];
    // (undocumented)
    invert: Op<P>;
    // (undocumented)
    op: Op<P>;
}

// @public (undocumented)
export class UndoRedoStack<S, P, Pr> {
    constructor(doc: Doc<S, P, Pr>);
    // (undocumented)
    clear(): void;
    // (undocumented)
    get length(): number;
    // (undocumented)
    nextAcceptedIndex: number;
    // (undocumented)
    onRemoteOp({ prevOps, sourceOp, afterOps }: RemoteOpEvent<P>): void;
    // (undocumented)
    pop(): PendingOp<P> & {
        needInvert: boolean;
    };
    // (undocumented)
    push(item: PendingOp<P>): void;
    // (undocumented)
    reduceNextAcceptedIndex(): void;
    // (undocumented)
    stack: UndoRedoItem<P>[];
}

// (No @packageDocumentation comment for this package)

```
## dev

```
npm i pnpm@8.x -g
pnpm i
pnpm dev
```

open: http://localhost:3000/

## release workflow

```
npm run pub
git push heroku main:master --force
```