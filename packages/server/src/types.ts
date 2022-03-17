import type { Task } from 'concurrent-runner';
import type {
  Op,
  SnapshotAndOps,
  GetOpsParams,
  GetSnapshotParams,
  CommitOpParams,
} from 'collaboration-engine-common';

export interface DB {
  getOps<P = unknown>(params: GetOpsParams): Promise<Op<P>[]>;
  getSnapshot<S = unknown, P = unknown>(
    params: GetSnapshotParams,
  ): Promise<SnapshotAndOps<S, P>>;
  commitOp(params: CommitOpParams): Promise<void>;
  saveSnapshot(params: CommitOpParams): Promise<void>;
}

export interface TimeTask extends Task<void> {
  time: number;
}
