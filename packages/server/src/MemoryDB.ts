import { DB } from './types';
import {
  Op,
  GetOpsParams,
  GetSnapshotParams,
  last,
  CommitOpParams,
  SaveSnapshotParams,
  Snapshot,
  DeleteDocParams,
  OTError,
} from 'ot-engine-common';

function checkDeleted(doc: DBDoc | undefined) {
  if (doc?.deleted) {
    throw new OTError({
      subType: 'deleted',
      detail: {},
    });
  }
}

function checkRollback(doc: DBDoc, fromVerson: number, toVersion?: number) {
  const { snapshots } = doc;
  const versions = Array.from(snapshots.keys());
  versions.sort().reverse();
  for (const v of versions) {
    if (toVersion && v > toVersion) {
      continue;
    }
    if (v <= fromVerson) {
      return;
    }
    if (snapshots.get(v)!.rollback) {
      throw new OTError({
        subType: 'rollback',
        detail: {},
      });
    }
  }
}

export class DBDoc {
  deleted = false;
  ops: Map<number, Op<unknown>> = new Map();
  snapshots: Map<number, Snapshot<unknown>> = new Map();
}

interface DocInfo {
  docId: string;
  collection: string;
}

function getDocKey({ docId, collection }: DocInfo) {
  return `${collection}_${docId}`;
}
export class MemoryDB implements DB {
  docs: Map<string, DBDoc> = new Map();

  async getOps<P>(params: GetOpsParams) {
    const doc = this.docs.get(getDocKey(params));
    const ops: Op<P>[] = [];
    if (doc) {
      checkDeleted(doc);
      checkRollback(doc, params.fromVersion, params.toVersion);
      const toVersion = params.toVersion ?? Infinity;
      for (let i = params.fromVersion; i <= toVersion; i++) {
        const op = doc.ops.get(i) as Op<P>;
        if (op) {
          ops.push(op);
        } else {
          break;
        }
      }
      return ops;
    }
    return ops;
  }
  async getSnapshot<S, P>(params: GetSnapshotParams) {
    const doc = this.docs.get(getDocKey(params));

    if (doc) {
      checkDeleted(doc);
      const { snapshots } = doc;
      if (params.version === undefined) {
        const snapshot = last(Array.from(snapshots.values())) as Snapshot<S>;
        if (!snapshot) {
          return undefined;
        }
        return {
          snapshot,
          ops: await this.getOps<P>({
            docId: params.docId,
            custom: params.custom,
            collection: params.collection,
            fromVersion: snapshot.version,
          }),
        };
      } else {
        let { version } = params;
        while (!snapshots.has(version)) {
          version--;
        }
        return {
          snapshot: snapshots.get(version)! as Snapshot<S>,
          ops: await this.getOps<P>({
            docId: params.docId,
            custom: params.custom,
            collection: params.collection,
            fromVersion: version,
            toVersion: params.toVersion,
          }),
        };
      }
    }
    return undefined;
  }

  getOrCreateDoc(params: DocInfo) {
    const docKey = getDocKey(params);
    let doc = this.docs.get(docKey);
    checkDeleted(doc);
    if (!doc) {
      doc = new DBDoc();
      this.docs.set(docKey, doc);
    }
    return doc;
  }
  async commitOp<P>(params: CommitOpParams<P>) {
    const { ops } = this.getOrCreateDoc(params);
    if (ops.has(params.op.version)) {
      throw new Error('op version conflict: ' + params.op.version);
    }
    ops.set(params.op.version, params.op);
  }
  async saveSnapshot<S>(params: SaveSnapshotParams<S>) {
    let { snapshot } = params;
    let doc = this.docs.get(getDocKey(params));
    if (doc) {
      checkDeleted(doc);
    }
    doc = this.getOrCreateDoc(params);
    if (!snapshot.version) {
      snapshot = { ...snapshot };
      const lastOp = last(Array.from(doc.ops.keys())) || 0;
      const lastSnapshot = last(Array.from(doc.snapshots.keys())) || 0;
      const lastVersion = Math.max(lastOp, lastSnapshot);
      snapshot.version = lastVersion + 1;
    }
    doc.snapshots.set(snapshot.version, snapshot);
  }

  async deleteDoc(params: DeleteDocParams): Promise<void> {
    const doc = this.docs.get(getDocKey(params));
    if (doc) {
      doc.deleted = true;
    }
  }
}
