export declare type AgentInfo = {
  custom?: any;
  docId: string;
  collection: string;
};

export declare type AgentInfoKeys = keyof AgentInfo;

export declare function applyAndInvert<S, P, Pr, I extends boolean>(
  snapshot: S,
  op: P,
  invert: I,
  otType: OTType<S, P, Pr>,
): I extends true ? [S, P] : [S, undefined];

export declare function assertNever(_: never): void;

export declare interface BaseRequest {
  seq: number;
}

export declare interface BaseResponse {
  seq: number;
  error?: any;
}

export declare type ClientRequest<P, Pr> =
  | RollbackRequest
  | PresencesRequest
  | DeleteDocRequest
  | PresenceRequest<Pr>
  | GetSnapshotRequest
  | GetOpsRequest
  | CommitOpRequest<P>;

export declare type ClientResponse<S, P, Pr> =
  | NotifyResponse<P, Pr>
  | RollbackResponse
  | DeleteDocResponse
  | CommitOpResponse<P>
  | GetOpsResponse<P>
  | GetSnapshotResponse<S, P, Pr>;

export declare interface CommitOpParams<P> extends AgentInfo {
  op: Op<P>;
}

export declare interface CommitOpRequest<P>
  extends Omit<CommitOpParams<P>, AgentInfoKeys>,
    BaseRequest {
  type: 'commitOp';
}

export declare interface CommitOpResponse<P> extends BaseResponse {
  type: 'commitOp';
  ops?: Op<P>[];
}

export declare type DeleteDocNotification = Omit<DeleteDocResponse, 'seq'>;

export declare type DeleteDocParams = AgentInfo;

export declare interface DeleteDocRequest
  extends Omit<DeleteDocParams, AgentInfoKeys>,
    BaseRequest {
  type: 'deleteDoc';
}

export declare interface DeleteDocResponse extends BaseResponse {
  type: 'deleteDoc';
}

export declare interface GetOpsParams extends AgentInfo {
  fromVersion: number;
  toVersion?: number;
}

export declare interface GetOpsRequest
  extends Omit<GetOpsParams, AgentInfoKeys>,
    BaseRequest {
  type: 'getOps';
}

export declare interface GetOpsResponse<P> extends BaseResponse {
  type: 'getOps';
  ops?: Op<P>[];
}

export declare interface GetSnapshotParams extends AgentInfo {
  version?: number;
  toVersion?: number;
}

export declare interface GetSnapshotRequest
  extends Omit<GetSnapshotParams, AgentInfoKeys>,
    BaseRequest {
  type: 'getSnapshot';
}

export declare interface GetSnapshotResponse<S, P, Pr> extends BaseResponse {
  type: 'getSnapshot';
  snapshotAndOps?: SnapshotAndOps<S, P>;
  presences?: Record<string, Presence<Pr>>;
}

export declare function isSameOp<P>(
  op: Op<P> | undefined,
  other: Op<P> | undefined,
): boolean;

export declare function last<T>(arr: T[], index?: number): T;

export declare interface Logger {
  log: (...msg: any) => void;
}

export declare function noop(): void;

export declare type NotifyResponse<P, Pr> =
  | RemoteOpResponse<P>
  | PresenceResponse<Pr>
  | PresencesResponse<Pr>
  | DeleteDocNotification
  | RollbackNotification;

export declare interface Op<P> {
  version: number;
  id: string;
  clientId: string;
  content: P;
}

export declare class OTError extends Error {
  type: OTErrorType;
  info: {
    subType: OTErrorSubType;
    detail: any;
    type: OTErrorType;
  };
  constructor(info: { subType: OTErrorSubType; detail: any });
}

export declare type OTErrorSubType = 'deleted' | 'rollback';

export declare type OTErrorType = 'otError';

export declare type OTSide = 'left' | 'right';

export declare type OTType<S, P, Pr> = {
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
  transformPresence?(presence: Pr, refOp: P, isOwnOp: boolean): Pr;
  serialize?(s: S): any;
  deserialize?(data: any): S;
};

export declare interface Presence<P> {
  version: number;
  content?: P;
}

export declare interface PresenceRequest<Pr> {
  type: 'presence';
  clientId: string;
  presence: Presence<Pr>;
}

export declare type PresenceResponse<Pr> = PresenceRequest<Pr>;

export declare interface PresencesRequest {
  type: 'presences';
}

export declare interface PresencesResponse<Pr> {
  type: 'presences';
  presences: Record<string, Presence<Pr>>;
}

export declare interface RemoteOpResponse<P> {
  type: 'remoteOp';
  clientId: string;
  ops: Op<P>[];
}

export declare type RollbackNotification = Omit<RollbackResponse, 'seq'>;

export declare interface RollbackParams extends AgentInfo {
  version: number;
}

export declare interface RollbackRequest
  extends Omit<RollbackParams, AgentInfoKeys>,
    BaseRequest {
  type: 'rollback';
}

export declare interface RollbackResponse extends BaseResponse {
  type: 'rollback';
}

export declare interface SaveSnapshotParams<S> extends AgentInfo {
  snapshot: Snapshot<S>;
}

export declare interface Snapshot<P> {
  version: number;
  rollback?: boolean;
  content: P;
}

export declare type SnapshotAndOps<S, P> = {
  snapshot: Snapshot<S>;
  ops: Op<P>[];
};

export declare function transformPresence<S, P, Pr>(
  presenceClientId: string,
  presence_: Pr,
  refOps: P[],
  clientIds: string[],
  otType: OTType<S, P, Pr>,
): Pr;

export declare function transformType<S, P, Pr>(
  op: P[],
  refOps: P[],
  otType: OTType<S, P, Pr>,
): [any[], any[]];

export {};
