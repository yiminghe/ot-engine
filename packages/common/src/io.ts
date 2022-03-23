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

export interface PresenceIO<Pr> {
  type: 'presence';
  clientId: string;
  presence: Presence<Pr>;
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

export interface CommitOpRequest<P>
  extends Omit<CommitOpParams<P>, AgentInfoKeys>,
    BaseRequest {
  type: 'commitOp';
}

export type ClientRequest<P, Pr> =
  | DeleteDocRequest
  | PresenceIO<Pr>
  | GetSnapshotRequest
  | GetOpsRequest
  | CommitOpRequest<P>;

interface BaseResponse {
  seq: number;
  error?: any;
}

export interface GetSnapshotResponse<S, P> extends BaseResponse {
  type: 'getSnapshot';
  snapshotAndOps?: SnapshotAndOps<S, P>;
}

export interface DeleteDocResponse extends BaseResponse {
  type: 'deleteDoc';
}

export interface GetOpsResponse<P> extends BaseResponse {
  type: 'getOps';
  ops?: Op<P>[];
}

export interface CommitOpResponse<P> extends BaseResponse {
  type: 'commitOp';
  ops?: Op<P>[];
}

export interface RemoteOpResponse<P> {
  type: 'remoteOp';
  clientId: string;
  ops: Op<P>[];
}

export type ClientResponse<S, P, Pr> =
  | DeleteDocResponse
  | PresenceIO<Pr>
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

export interface CommitOpParams<P> extends AgentInfo {
  op: Op<P>;
}

export interface SaveSnapshotParams<S> extends AgentInfo {
  snapshot: {
    content: S;
    version: number;
  };
}
