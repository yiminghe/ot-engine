export type OTSide = 'left' | 'right';

export type OTType<S = any, P = any> = {
  name: string;
  create(data: any): S;
  applyAndInvert?(snapshot: S, op: P, invert: boolean): [S, P | undefined];
  apply?(snapshot: S, op: P): S;
  invert?(op: P): P;
  invertWithDoc?(op: P, snapshot: S): P;
  compose?(op: P, prevOp: P): P | undefined;
  transform(op: P, refOp: P, side: OTSide): P;
  transformPresence?(presence: any, refOp: P): any;
  serialize(s: S): any;
  deserialize(data: any): S;
};

export interface Op<P = any> {
  version: number;
  id: string;
  createdTime: number;
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

export interface Presence {
  version: number;
  clientId: string;
  content?: any;
}
