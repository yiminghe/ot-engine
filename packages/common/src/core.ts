export type OTSide = 'left' | 'right';

export type OTType<S, P, Pr> = {
  name: string;
  create?(data: any): S;
  applyAndInvert?<I extends boolean>(
    snapshot: S,
    op: P,
    invert: I,
  ): I extends true ? [S, P] : [S, undefined];
  apply?(snapshot: S, op: P): S;
  invert?(op: P): P;
  invertWithDoc?(op: P, snapshot: S): P;
  compose?(op: P, prevOp: P): P | undefined;
  transform(op: P, refOp: P, side: OTSide): P;
  transformPresence?(presence: Pr, refOp: P): Pr;
  serialize?(s: S): any;
  deserialize?(data: any): S;
};

export interface Op<P> {
  version: number;
  id: string;
  content: P;
}

export interface Snapshot<P> {
  version: number;
  content: P;
}

export type SnapshotAndOps<S, P> = {
  snapshot: Snapshot<S>;
  ops: Op<P>[];
};

export interface Presence<P> {
  version: number;
  content?: P;
}
