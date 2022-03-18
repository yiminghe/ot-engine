import type { OTSide, OTType } from './core';

export function transformType(op: any[], prevOps: any[], otType: OTType) {
  return transform(op, prevOps, 'left', otType.transform);
}

function transform(
  op: any[],
  otherOp: any[],
  side: OTSide,
  transformOne: (opComponent: any, otherOpComponent: any, side: OTSide) => any,
): [any[], any[]] {
  if (!otherOp.length || !op.length) return [op, otherOp];

  const ops_00_01 = op[0];
  const ops_01_0n = op.slice(1);
  const ops_00_10 = otherOp[0];
  const ops_10_n0 = otherOp.slice(1);
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
