import type { Op, SnapshotAndOps } from './core';

type DocInfoKeys = 'collection' | 'docId';

interface BaseRequest {
  seq: number;
}

export interface GetSnapshotRequest
  extends Omit<GetSnapshotParams, DocInfoKeys>,
    BaseRequest {
  type: 'getSnapshot';
}

export interface GetOpsRequest
  extends Omit<GetOpsParams, DocInfoKeys>,
    BaseRequest {
  type: 'getOps';
}

export interface CommitOpRequest
  extends Omit<CommitOpParams, DocInfoKeys>,
    BaseRequest {
  type: 'commitOp';
}

export type ClientRequest =
  | GetSnapshotRequest
  | GetOpsRequest
  | CommitOpRequest;

interface BaseResponse {
  seq: number;
  error?: any;
}

export interface GetSnapshotResponse<S, P> extends BaseResponse {
  type: 'getSnapshot';
  snapshotAndOps?: SnapshotAndOps<S, P>;
}

export interface GetOpsResponse<P> extends BaseResponse {
  type: 'getOps';
  ops?: Op<P>[];
}

export interface CommitOpResponse<P = any> extends BaseResponse {
  type: 'commitOp';
  ops?: Op<P>[];
}

export interface RemoteOpResponse<P = any> {
  type: 'remoteOp';
  ops: Op<P>[];
}

export type ClientResponse<S = any, P = any> =
  | CommitOpResponse<P>
  | GetOpsResponse<P>
  | GetSnapshotResponse<S, P>
  | RemoteOpResponse<P>;

export interface GetOpsParams {
  collection: string;
  docId: string;
  fromVersion: number;
  toVersion?: number;
}

export interface GetSnapshotParams {
  collection: string;
  docId: string;
  version?: number;
}

export interface CommitOpParams {
  collection: string;
  docId: string;
  op: Op;
}

export interface SaveSnapshotParams<S = any> {
  collection: string;
  docId: string;
  snapshot: S;
  version: number;
}
