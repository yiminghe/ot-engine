import { DB } from './types';
import {
  Op,
  GetOpsParams,
  GetSnapshotParams,
  last,
  CommitOpParams,
  SaveSnapshotParams,
  Snapshot,
} from 'ot-engine-common';

export class DBDoc {
  ops: Map<number, Op> = new Map();
  snapshots: Map<number, Snapshot> = new Map();
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

  async getOps(params: GetOpsParams) {
    const doc = this.docs.get(getDocKey(params));
    const ops: Op[] = [];
    if (doc) {
      const toVersion = params.toVersion ?? Infinity;
      for (let i = params.fromVersion; i <= toVersion; i++) {
        const op = doc.ops.get(i);
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
  async getSnapshot(params: GetSnapshotParams) {
    const doc = this.docs.get(getDocKey(params));

    if (doc) {
      const { snapshots } = doc;
      if (params.version === undefined) {
        const snapshot = last(Array.from(snapshots.values()));
        if (!snapshot) {
          return undefined;
        }
        return {
          snapshot,
          ops: await this.getOps({
            docId: params.docId,
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
          snapshot: snapshots.get(version)!,
          ops: await this.getOps({
            docId: params.docId,
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
    if (!doc) {
      doc = new DBDoc();
      this.docs.set(docKey, doc);
    }
    return doc;
  }
  async commitOp(params: CommitOpParams) {
    const { ops } = this.getOrCreateDoc(params);
    if (ops.has(params.op.version)) {
      throw new Error('op version conflict: ' + params.op.version);
    }
    ops.set(params.op.version, params.op);
  }
  async saveSnapshot(params: SaveSnapshotParams) {
    const { snapshot } = params;
    this.getOrCreateDoc(params).snapshots.set(snapshot.version, snapshot);
  }
}
