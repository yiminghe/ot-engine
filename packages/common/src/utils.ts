import type { OTSide, OTType, Op } from './core';

export function transformType<S, P, Pr>(
  op: P[],
  refOps: P[],
  otType: OTType<S, P, Pr>,
) {
  return transform(op, refOps, 'left', otType.transform);
}

export function applyAndInvert<S, P, Pr, I extends boolean>(
  snapshot: S,
  op: P,
  invert: I,
  otType: OTType<S, P, Pr>,
): I extends true ? [S, P] : [S, undefined] {
  if (otType.applyAndInvert) {
    return otType.applyAndInvert(snapshot, op, invert);
  }
  const ret: [S, P | undefined] = [] as any;
  if (invert) {
    if (otType.invertWithDoc) {
      ret[1] = otType.invertWithDoc(op, snapshot);
    } else if (otType.invert) {
      ret[1] = otType.invert(op);
    } else {
      throw new Error('lack invert/invertWithDoc in otType: ' + otType.name);
    }
  }
  if (!otType.apply) {
    throw new Error('lack apply in otType: ' + otType.name);
  }
  ret[0] = otType.apply(snapshot, op);
  return ret as any;
}

export function transformPresence<S, P, Pr>(
  presenceClientId: string,
  presence: Pr,
  refOps: P[],
  clientIds: string[],
  otType: OTType<S, P, Pr>,
) {
  if (otType.transformPresence) {
    for (let i = 0; i < refOps.length; i++) {
      const op = refOps[i];
      const opClientId = clientIds[i];
      presence = otType.transformPresence(
        presence,
        op,
        opClientId === presenceClientId,
      );
    }
  }
  return presence;
}

function transform(
  op: any[],
  refOps: any[],
  side: OTSide,
  transformOne: (opComponent: any, otherOpComponent: any, side: OTSide) => any,
): [any[], any[]] {
  if (!refOps.length || !op.length) return [op, refOps];

  const ops_00_01 = op[0];
  const ops_01_0n = op.slice(1);
  const ops_00_10 = refOps[0];
  const ops_10_n0 = refOps.slice(1);
  const invertSide = side === 'right' ? 'left' : 'right';
  const ops_10_11 = transformOne(ops_00_01, ops_00_10, side);
  const ops_01_11 = transformOne(ops_00_10, ops_00_01, invertSide);
  const [ops_11_n1, ops_n0_n1] = transform(
    ops_10_n0,
    [ops_10_11],
    invertSide,
    transformOne,
  );
  const [ops_0n_1n, ops_11_1n] = transform(
    [ops_01_11],
    ops_01_0n,
    invertSide,
    transformOne,
  );
  const [ops_n1_nn, ops_1n_nn] = transform(
    ops_11_1n,
    ops_11_n1,
    side,
    transformOne,
  );

  return [
    [...ops_n0_n1, ...ops_n1_nn],
    [...ops_0n_1n, ...ops_1n_nn],
  ];
}

export function last<T>(arr: T[], index = 1) {
  return arr && arr[arr.length - index];
}

export class OTError extends Error {
  type = 'otError';
  info: { subType: string; detail: any; type: string };
  constructor(info: { subType: string; detail: any }) {
    super(info.subType);
    this.info = {
      ...info,
      type: this.type,
    };
  }
}

export function isSameOp<P>(op: Op<P> | undefined, other: Op<P> | undefined) {
  if (op && other) {
    return op.clientId === other.clientId && op.id === other.id;
  }
  return op === other;
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
export function noop() {}

export function assertNever(_: never) {
  throw new Error('never!' + _);
}
