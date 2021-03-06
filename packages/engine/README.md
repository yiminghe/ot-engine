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
cd examples/rich-text
yarn server
yarn client
```

open: http://localhost:3000/

## ot type definition

```ts
export type OTType<S, P,Pr> = {
  name: string;
  create?(data: any): S;
  applyAndInvert?(snapshot: S, op: P, invert: boolean): [S, P | undefined];
  apply?(snapshot: S, op: P): S;
  invert?(op: P): P;
  invertWithDoc?(op: P, snapshot: S): P;
  transform(op: P, refOp: P, side: OTSide): P;
  transformPresence?(presence: Pr, refOp: P, isOwnOp:boolean): Pr;
  serialize?(s: S): any;
  deserialize?(data: any): S;
};
```

## ot-engine/server

```ts
export interface Op<P> {
  version: number;
  id: string;
  content: P;
}

export interface Snapshot<S> {
  version: number;
  rollback?: boolean;
  content: S;
}

export type SnapshotAndOps<S, P> = {
  snapshot: Snapshot<S>;
  ops: Op<P>[];
};

export interface GetOpsParams {
  custom?: any;
  collection: string;
  docId: string;
  fromVersion: number;
  toVersion?: number;
}

export interface GetSnapshotParams {
  custom?: any;
  collection: string;
  docId: string;
  version?: number;
  toVersion?: number;
}

export interface CommitOpParams<P> {
  custom?: any;
  collection: string;
  docId: string;
  op: Op<P>;
}

export interface SaveSnapshotParams<S> {
  custom?: any;
  collection: string;
  docId: string;
  snapshot: Snapshot<S>;
}

export interface DB {
    getOps<P>(params: GetOpsParams): Promise<Op<P>[]>;
    getSnapshot<S, P>(params: GetSnapshotParams): Promise<SnapshotAndOps<S, P> | undefined>;
    commitOp<P>(params: CommitOpParams<P>): Promise<void>;
    saveSnapshot<S>(params: SaveSnapshotParams<S>): Promise<void>;
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
export interface AgentConfig<S,P,Pr,Custom> {
  /** passed to db */
  custom?:Custom;
  stream: Duplex;
  collection: string;
  docId: string;
  clientId: string;
  otType: OTType<S,P,Pr>;
}
export declare class Server {
    constructor(params?: ServerConfig);
    handleStream<S,P,Pr,Custom>(config: AgentConfig<S,P,Pr,Custom>): void;
}
```

## ot-engine/client

```ts
import { Event,EventTarget } from 'ts-event-target';

interface DocConfig<S,P,Pr> {
    socket: WebSocket;
    otType: OTType<S,P,Pr>;
    clientId: string;
    undoStackLimit?: number;
    cacheServerOpsLimit?: number;
}
declare class OpEvent<P> extends Event<'op'> {
    ops: P[];
    undoRedo: boolean;
    source: boolean;
    constructor();
}
declare class BeforeOpEvent<P> extends Event<'beforeOp'> {
    ops: P[];
    undoRedo: boolean;
    source: boolean;
    constructor();
}
declare class RemoteDeleteDocEvent extends Event<'remoteDeleteDoc'> {
  constructor();
}
declare class RollbackEvent extends Event<'rollback'> {
  constructor();
}
export declare class Doc<S,P,Pr> extends EventTarget<[
  OpEvent<P>,
  BeforeOpEvent<P>,
  RemoteDeleteDocEvent,
  RollbackEvent
  ]> {
    constructor(config: DocConfig<S,P,Pr>);
    canUndo(): boolean;
    canRedo(): boolean;
    undo(): void;
    redo(): void;
    destroy(): void;
    submitOp(opContent: P): void;
    submitPresence(presence: Pr): void;
    delete(): Promise<void>;
    rollback(params: {version:number}): Promise<void>;
    fetch(): Promise<Snapshot<S>>;
    data:S;
    remotePresences:Record<string,Pr>;
}
```

## release workflow

```
yarn version check -i
yarn version apply --all
yarn run pub
```