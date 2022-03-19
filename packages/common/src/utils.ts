import type { OTSide, OTType } from './core';

export function transformType(op: any[], refOps: any[], otType: OTType) {
  return transform(op, refOps, 'left', otType.transform);
}

export function applyAndInvert(
  snapshot: any,
  op: any,
  invert: boolean,
  otType: OTType,
) {
  if (otType.applyAndInvert) {
    return otType.applyAndInvert(snapshot, op, invert);
  }
  let ret = [];
  if (invert) {
    if (otType.invertWithDoc) {
      ret[1] = otType.invertWithDoc(op, snapshot);
    } else if (otType.invert) {
      ret[1] = otType.invert(op);
    }
    throw new Error('lack invert/invertWithDoc in otType: ' + otType.name);
  }
  if (!otType.apply) {
    throw new Error('lack apply in otType: ' + otType.name);
  }
  ret[0] = otType.apply(snapshot, op);
  return ret;
}

export function transformPresence(
  presence: any,
  refOps: any[],
  otType: OTType,
) {
  const { transformPresence } = otType;
  if (transformPresence) {
    for (const op of refOps) {
      presence = transformPresence(presence, op);
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
    ops_10_11,
    invertSide,
    transformOne,
  );
  const [ops_0n_1n, ops_11_1n] = transform(
    ops_01_11,
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

export function last<T>(arr: T[]) {
  return arr[arr.length - 1];
}
