import type {
  Op,
  SnapshotAndOps,
  GetOpsParams,
  GetSnapshotParams,
  CommitOpParams,
  SaveSnapshotParams,
  DeleteDocParams,
  SaveLatestSnapshotParams,
} from 'ot-engine-common';

export interface DB {
  getOps<P>(params: GetOpsParams): Promise<Op<P>[]>;
  getSnapshot<S, P>(
    params: GetSnapshotParams,
  ): Promise<SnapshotAndOps<S, P> | undefined>;
  commitOp<P>(params: CommitOpParams<P>): Promise<void>;
  saveSnapshot<S>(params: SaveSnapshotParams<S>): Promise<void>;
  saveLatestSnapshot<S>(params: SaveLatestSnapshotParams<S>): Promise<void>;
  deleteDoc(params: DeleteDocParams): Promise<void>;
}

export interface PubSubData<D> {
  data: D | undefined;
}

export interface PubSub<D> {
  subscribe(channel: string, callback: (d: PubSubData<D>) => void): void;
  publish(channel: string, data: D): void;
  unsubscribe(channel: string, callback: (d: PubSubData<D>) => void): void;
}
