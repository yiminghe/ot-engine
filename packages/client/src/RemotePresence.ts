import { Doc } from './doc';
import { Op, Presence, transformPresence, PresenceIO } from 'ot-engine-common';
import { RemoteOpEvent, RemotePresenceEvent, PresenceItem } from './types';

export class RemotePresence {
  remotePresence: Map<string, PresenceItem> = new Map();

  serverOps: Op[] = [];

  getOrCreatePresenceItem(clientId: string) {
    let item = this.remotePresence.get(clientId);
    if (!item) {
      item = {};
      this.remotePresence.set(clientId, item);
    }
    return item;
  }

  constructor(private doc: Doc) {
    if (doc.otType.transformPresence) {
      doc.addEventListener('op', (e) => {
        this.syncRemotePresences(e.ops, e.source);
      });
    }
  }

  onPresenceResponse(response: PresenceIO) {
    const { doc } = this;
    const { presence } = response;
    if (presence.content) {
      const syncedPresence = this.syncPresence(presence);
      const item = this.getOrCreatePresenceItem(presence.clientId);
      if (syncedPresence) {
        item.pending = undefined;
        item.normal = syncedPresence;
        const event = new RemotePresenceEvent();
        event.changed.set(presence.clientId, syncedPresence);
        doc.dispatchEvent(event);
      } else {
        item.pending = presence;
      }
    } else {
      const event = new RemotePresenceEvent();
      this.remotePresence.delete(presence.clientId);
      event.changed.set(presence.clientId, null);
      doc.dispatchEvent(event);
    }
  }

  onRemoteOp({ prevOps, myOp, afterOps }: RemoteOpEvent) {
    const ops = this.serverOps;
    if (prevOps) {
      ops.push(...prevOps);
    }
    if (myOp) {
      ops.push(myOp);
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
    for (const item of Array.from(this.remotePresence.values())) {
      const { pending, normal } = item;
      if (!onlyNormal && pending) {
        const p = this.syncPresence(pending);
        if (p) {
          item.normal = p;
          item.pending = undefined;
          changed.set(p.clientId, p.content);
          continue;
        }
      }
      if (normal) {
        normal.content = transformPresence(
          normal.content,
          ops,
          this.doc.otType,
        );
        changed.set(normal.clientId, normal.content);
      }
    }
    if (changed.size) {
      const event = new RemotePresenceEvent();
      event.changed = changed;
      this.doc.dispatchEvent(event);
    }
  }

  syncPresence(presence: Presence) {
    const { doc } = this;
    if (presence.version > doc.version) {
      return;
    }
    let transformOps;
    if (presence.version === doc.version) {
      transformOps = doc.allPendingOps;
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
