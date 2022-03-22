# ot-engine

[![NPM version](https://badge.fury.io/js/ot-engine.png)](http://badge.fury.io/js/ot-engine)
[![NPM downloads](http://img.shields.io/npm/dm/ot-engine.svg)](https://npmjs.org/package/ot-engine)
[![Build Status](https://app.travis-ci.com/yiminghe/ot-engine.svg?branch=main)](https://app.travis-ci.com/github/yiminghe/ot-engine)

Operational transformation engine

## features

- typescript full stack
- support local undo/redo
- support presence(cursors)

## demo

```
yarn
cd examples/ot-tree
yarn server
yarn client
```

open: http://localhost:3000/

## ot type definition

```ts
export type OTType<S = any, P = any> = {
  name: string;
  create?(data: any): S;
  applyAndInvert?(snapshot: S, op: P, invert: boolean): [S, P | undefined];
  apply?(snapshot: S, op: P): S;
  invert?(op: P): P;
  invertWithDoc?(op: P, snapshot: S): P;
  transform(op: P, refOp: P, side: OTSide): P;
  transformPresence?(presence: any, refOp: P): any;
  serialize?(s: S): any;
  deserialize?(data: any): S;
};
```

## ot-engine/server

```ts
export interface Op<P = any> {
  version: number;
  id: string;
  content: P;
}

export interface Snapshot<P = any> {
  version: number;
  content: P;
}

export type SnapshotAndOps<S, P> = {
  snapshot: Snapshot<S>;
  ops: Op<P>[];
};

export interface GetOpsParams {
  collection: string;
  docId: string;
  fromVersion: number;
  toVersion?: number;
}

export interface GetSnapshotParams {
  collection: string;
  docId: string;
  version?: number;
  toVersion?: number;
}

export interface CommitOpParams {
  collection: string;
  docId: string;
  op: Op;
}

export interface SaveSnapshotParams<S = any> {
  collection: string;
  docId: string;
  snapshot: {
    content: S;
    version: number;
  };
}

export interface DB {
    getOps<P = unknown>(params: GetOpsParams): Promise<Op<P>[]>;
    getSnapshot<S = unknown, P = unknown>(params: GetSnapshotParams): Promise<SnapshotAndOps<S, P> | undefined>;
    commitOp(params: CommitOpParams): Promise<void>;
    saveSnapshot(params: SaveSnapshotParams): Promise<void>;
}
export interface PubSubData {
    data: any;
}
export interface PubSub {
    subscribe(channel: string, callback: (d: PubSubData) => void): void;
    publish(channel: string, data: any): void;
    unsubscribe(channel: string, callback: (d: PubSubData) => void): void;
}
export interface ServerConfig {
    saveInterval?: number;
    db?: DB;
    pubSub?: PubSub;
}
export interface AgentConfig {
  stream: Duplex;
  collection: string;
  docId: string;
  clientId: string;
  otType: OTType;
}
export declare class Server {
    constructor(params?: ServerConfig);
    handleStream(config: AgentConfig): void;
}
```

## ot-engine/client

```ts
interface DocConfig {
    socket: WebSocket;
    otType: OTType;
    clientId: string;
    undoStackLimit?: number;
    cacheServerOpsLimit?: number;
}
import { Event } from 'ts-event-target';
declare class OpEvent extends Event<'op'> {
    ops: any[];
    source: boolean;
    constructor();
}
export declare class Doc extends EventTarget<[OpEvent]> {
    constructor(config: DocConfig);
    canUndo(): boolean;
    canRedo(): boolean;
    undo(): void;
    redo(): void;
    destryoy(): void;
    submitOp(opContent: any): void;
    fetch(): Promise<Snapshot<any>>;
}
```