export type OTSide = 'left' | 'right';

export type OTType = {
  name: string;
  applyAndInvert<D, P>(data: D, op: P, invert: boolean): [D, P];
  compose?<P>(op: P, prevOp: P): P | undefined;
} & (
  | {
      transform<P>(op: P, refOp: P, side: OTSide): [P[], P[]];
    }
  | {
      transforms<P>(op: P[], refOp: P[], side: OTSide): [P[], P[]];
    }
);

export interface Op<P = unknown> {
  version: number;
  id: string;
  content: P;
}

export interface Snapshot<P = unknown> {
  version: number;
  content: P;
}

export type SnapshotAndOps<S, P> = {
  snapshot: Snapshot<S>;
  ops: Op<P>[];
};
