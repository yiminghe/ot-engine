import type { Op, SnapshotAndOps, Presence, Snapshot } from './core';

type AgentInfo = {
  custom?: any;
  docId: string;
  collection: string;
};

type AgentInfoKeys = keyof AgentInfo;

interface BaseRequest {
  seq: number;
}

export interface PresenceRequest<Pr> {
  type: 'presence';
  clientId: string;
  presence: Presence<Pr>;
}

export type PresenceResponse<Pr> = PresenceRequest<Pr>;

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

export interface PresencesRequest {
  type: 'presences';
}

export interface GetOpsRequest
  extends Omit<GetOpsParams, AgentInfoKeys>,
    BaseRequest {
  type: 'getOps';
}

export interface RollbackRequest
  extends Omit<RollbackParams, AgentInfoKeys>,
    BaseRequest {
  type: 'rollback';
}

export interface CommitOpRequest<P>
  extends Omit<CommitOpParams<P>, AgentInfoKeys>,
    BaseRequest {
  type: 'commitOp';
}

export type ClientRequest<P, Pr> =
  | RollbackRequest
  | PresencesRequest
  | DeleteDocRequest
  | PresenceRequest<Pr>
  | GetSnapshotRequest
  | GetOpsRequest
  | CommitOpRequest<P>;

interface BaseResponse {
  seq: number;
  error?: any;
}

export interface GetSnapshotResponse<S, P, Pr> extends BaseResponse {
  type: 'getSnapshot';
  snapshotAndOps?: SnapshotAndOps<S, P>;
  presences?: Record<string, Presence<Pr>>;
}

export interface DeleteDocResponse extends BaseResponse {
  type: 'deleteDoc';
}

export type DeleteDocNotification = Omit<DeleteDocResponse, 'seq'>;
export type RollbackNotification = Omit<RollbackResponse, 'seq'>;

export interface PresencesResponse<Pr> {
  type: 'presences';
  presences: Record<string, Presence<Pr>>;
}

export interface GetOpsResponse<P> extends BaseResponse {
  type: 'getOps';
  ops?: Op<P>[];
}

export interface RollbackResponse extends BaseResponse {
  type: 'rollback';
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

export type NotifyResponse<P, Pr> =
  | RemoteOpResponse<P>
  | PresenceResponse<Pr>
  | PresencesResponse<Pr>
  | DeleteDocNotification
  | RollbackNotification;
export type ClientResponse<S, P, Pr> =
  | NotifyResponse<P, Pr>
  | RollbackResponse
  | DeleteDocResponse
  | CommitOpResponse<P>
  | GetOpsResponse<P>
  | GetSnapshotResponse<S, P, Pr>;

export interface GetOpsParams extends AgentInfo {
  fromVersion: number;
  toVersion?: number;
}

export interface RollbackParams extends AgentInfo {
  version: number;
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
  snapshot: Snapshot<S>;
}
