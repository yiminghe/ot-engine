import { Doc } from './doc';
import { Op, Presence, transformPresence, PresenceIO } from 'ot-engine-common';
import { RemoteOpEvent, RemotePresenceEvent, PresenceItem } from './types';

export class RemotePresence<S, P, Pr> {
  remotePresence: Map<string, PresenceItem<Pr>> = new Map();

  serverOps: Op<P>[] = [];

  getOrCreatePresenceItem(clientId: string) {
    let item = this.remotePresence.get(clientId);
    if (!item) {
      item = {};
      this.remotePresence.set(clientId, item);
    }
    return item;
  }

  constructor(private doc: Doc<S, P, Pr>) {
    if (doc.otType.transformPresence) {
      doc.addEventListener('op', (e) => {
        this.syncRemotePresences(e.ops, e.source);
      });
    }
  }

  onPresenceResponse(response: PresenceIO<Pr>) {
    const { doc } = this;
    const { presence, clientId } = response;
    if (presence.content) {
      const syncedPresence = this.syncPresence(presence);
      const item = this.getOrCreatePresenceItem(clientId);
      if (syncedPresence) {
        item.pending = undefined;
        item.normal = syncedPresence;
        const event = new RemotePresenceEvent<Pr>();
        event.changed.set(clientId, syncedPresence.content);
        doc.dispatchEvent(event);
      } else {
        item.pending = presence;
      }
    } else {
      const event = new RemotePresenceEvent<Pr>();
      this.remotePresence.delete(clientId);
      event.changed.set(clientId, undefined);
      doc.dispatchEvent(event);
    }
  }

  onRemoteOp({ prevOps, sourceOp, afterOps }: RemoteOpEvent<P>) {
    const ops = this.serverOps;
    if (prevOps) {
      ops.push(...prevOps);
    }
    if (sourceOp) {
      ops.push(sourceOp);
    }
    if (afterOps) {
      ops.push(...afterOps);
    }
    if (ops.length > this.doc.config.cacheServerOpsLimit) {
      this.serverOps = ops.slice(-this.doc.config.cacheServerOpsLimit);
    }
  }

  syncRemotePresences(ops: any[], onlyNormal = false) {
    const changed = new Map();
    for (const clientId of Array.from(this.remotePresence.keys())) {
      const item = this.remotePresence.get(clientId)!;
      const { pending, normal } = item;
      if (!onlyNormal && pending) {
        const p = this.syncPresence(pending);
        if (p) {
          item.normal = p;
          item.pending = undefined;
          changed.set(clientId, p.content);
          continue;
        }
      }
      if (normal) {
        normal.content = transformPresence(
          normal.content,
          ops,
          this.doc.otType,
        );
        changed.set(clientId, normal.content);
      }
    }
    if (changed.size) {
      const event = new RemotePresenceEvent<Pr>();
      event.changed = changed;
      this.doc.dispatchEvent(event);
    }
  }

  syncPresence(presence: Presence<Pr>) {
    const { doc } = this;
    if (presence.version > doc.version) {
      return;
    }
    let transformOps;
    if (presence.version === doc.version) {
      transformOps = doc.allPendingOps.map((o) => o.op.content);
    } else {
      const { serverOps } = this;
      const l = serverOps.length;
      let i;
      for (i = l - 1; i >= 0; i--) {
        const op = serverOps[i];
        if (op.version === presence.version) {
          break;
        }
      }
      if (i < 0) {
        return;
      }
      transformOps = serverOps
        .map((o) => o.content)
        .slice(i)
        .concat(doc.allPendingOps.map((o) => o.op.content));
    }
    presence.content = transformPresence(
      presence.content!,
      transformOps,
      doc.otType,
    );
    return presence;
  }
}
