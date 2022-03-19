import type {
  Op,
  SnapshotAndOps,
  GetOpsParams,
  GetSnapshotParams,
  CommitOpParams,
  SaveSnapshotParams,
  Snapshot,
} from 'ot-engine-common';

export interface DB {
  getOps<P = unknown>(params: GetOpsParams): Promise<Op<P>[]>;
  getSnapshot<S = unknown, P = unknown>(
    params: GetSnapshotParams,
  ): Promise<SnapshotAndOps<S, P> | undefined>;
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
