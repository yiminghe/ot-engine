import type { Op, SnapshotAndOps, Presence } from './core';

type AgentInfo = {
  custom?: any;
  docId: string;
  collection: string;
};

type AgentInfoKeys = keyof AgentInfo;

interface BaseRequest {
  seq: number;
}

export interface PresenceIO {
  type: 'presence';
  presence: Presence;
}

export interface GetSnapshotRequest
  extends Omit<GetSnapshotParams, AgentInfoKeys>,
    BaseRequest {
  type: 'getSnapshot';
}

export interface DeleteDocRequest
  extends Omit<DeleteDocParams, AgentInfoKeys>,
    BaseRequest {
  type: 'deleteDoc';
}

export interface GetOpsRequest
  extends Omit<GetOpsParams, AgentInfoKeys>,
    BaseRequest {
  type: 'getOps';
}

export interface CommitOpRequest
  extends Omit<CommitOpParams, AgentInfoKeys>,
    BaseRequest {
  type: 'commitOp';
}

export type ClientRequest =
  | DeleteDocRequest
  | PresenceIO
  | GetSnapshotRequest
  | GetOpsRequest
  | CommitOpRequest;

interface BaseResponse {
  seq: number;
  error?: any;
}

export interface GetSnapshotResponse<S = any, P = any> extends BaseResponse {
  type: 'getSnapshot';
  snapshotAndOps?: SnapshotAndOps<S, P>;
}

export interface DeleteDocResponse extends BaseResponse {
  type: 'deleteDoc';
}

export interface GetOpsResponse<P = any> extends BaseResponse {
  type: 'getOps';
  ops?: Op<P>[];
}

export interface CommitOpResponse<P = any> extends BaseResponse {
  type: 'commitOp';
  ops?: Op<P>[];
}

export interface RemoteOpResponse<P = any> {
  type: 'remoteOp';
  clientId: string;
  ops: Op<P>[];
}

export type ClientResponse<S = any, P = any> =
  | DeleteDocResponse
  | PresenceIO
  | CommitOpResponse<P>
  | GetOpsResponse<P>
  | GetSnapshotResponse<S, P>
  | RemoteOpResponse<P>;

export interface GetOpsParams extends AgentInfo {
  fromVersion: number;
  toVersion?: number;
}

export type DeleteDocParams = AgentInfo;

export interface GetSnapshotParams extends AgentInfo {
  version?: number;
  toVersion?: number;
}

export interface CommitOpParams extends AgentInfo {
  op: Op;
}

export interface SaveSnapshotParams<S = any> extends AgentInfo {
  snapshot: {
    content: S;
    version: number;
  };
}
