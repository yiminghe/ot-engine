import { Op, Presence, transformPresence } from 'ot-engine-common';
import { Doc } from './doc';
import { PresenceItem, RemoteOpEvent, RemotePresenceEvent } from './types';

export class RemotePresenceManager<S, P, Pr> {
  remotePresenceMap: Map<string, PresenceItem<Pr>> = new Map();

  serverOps: Op<P>[] = [];

  clear() {
    this.serverOps = [];
    const changed: Map<string, Pr | undefined> = new Map();
    for (const clientId of Array.from(this.remotePresenceMap.keys())) {
      changed.set(clientId, undefined);
    }
    if (changed.size) {
      const event = new RemotePresenceEvent<Pr>();
      event.changed = changed;
      this.doc.dispatchEvent(event);
    }
  }

  getOrCreatePresenceItem(clientId: string) {
    let item = this.remotePresenceMap.get(clientId);
    if (!item) {
      item = {};
      this.remotePresenceMap.set(clientId, item);
    }
    return item;
  }

  constructor(private doc: Doc<S, P, Pr>) {
    if (doc.otType.transformPresence) {
      doc.addEventListener('op', (e) => {
        this.syncRemotePresences(e.ops, e.clientIds, e.source);
      });
      doc.addEventListener('remoteOp', this.onRemoteOp);
    }
  }

  get remotePresences() {
    // undefined means not transformed(not valid to use)
    const ret: Map<string, Pr | undefined> = new Map();
    for (const clientId of Array.from(this.remotePresenceMap.keys())) {
      const { normal } = this.remotePresenceMap.get(clientId)!;
      ret.set(clientId, normal?.content);
    }
    return ret;
  }

  reload(presences: Record<string, Presence<Pr>>, fire = true) {
    const changed = new Map();
    for (const clientId of Object.keys(presences)) {
      this.onPresenceResponse(
        {
          clientId,
          presence: presences[clientId],
        },
        changed,
      );
    }
    const { remotePresenceMap } = this;
    for (const clientId of Array.from(remotePresenceMap.keys())) {
      if (!presences[clientId]) {
        this.onPresenceResponse(
          {
            clientId,
            presence: {
              content: undefined,
              version: 0,
            },
          },
          changed,
        );
      }
    }
    if (fire) {
      const event = new RemotePresenceEvent<Pr>();
      event.changed = changed;
      this.doc.dispatchEvent(event);
    }
    return changed;
  }

  onPresenceResponse(
    response: { clientId: string; presence: Presence<Pr> },
    changeSet?: Map<string, Pr | undefined>,
  ) {
    const { doc } = this;
    const { presence, clientId } = response;
    if (clientId === doc.clientId) {
      return;
    }
    if (presence.content) {
      const syncedPresence = this.syncPresence(clientId, presence);
      const item = this.getOrCreatePresenceItem(clientId);
      if (syncedPresence) {
        item.pending = undefined;
        item.normal = syncedPresence;
        if (!changeSet) {
          const event = new RemotePresenceEvent<Pr>();
          event.changed.set(clientId, syncedPresence.content);
          doc.dispatchEvent(event);
        } else {
          changeSet.set(clientId, syncedPresence.content);
        }
      } else {
        item.pending = presence;
      }
    } else {
      if (!changeSet) {
        const event = new RemotePresenceEvent<Pr>();
        this.remotePresenceMap.delete(clientId);
        // undefined means offline,need to delete from UI
        event.changed.set(clientId, undefined);
        doc.dispatchEvent(event);
      } else {
        changeSet.set(clientId, undefined);
      }
    }
  }

  onRemoteOp = ({ prevOps, sourceOp, afterOps }: RemoteOpEvent<P>) => {
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
  };

  syncRemotePresences(ops: P[], clientIds: string[], onlyNormal = false) {
    console.log('syncRemotePresences', ops, clientIds, onlyNormal);
    const changed = new Map();
    for (const clientId of Array.from(this.remotePresenceMap.keys())) {
      const item = this.remotePresenceMap.get(clientId)!;
      const { pending, normal } = item;
      if (!onlyNormal && pending) {
        const p = this.syncPresence(clientId, pending);
        if (p) {
          item.normal = p;
          item.pending = undefined;
          changed.set(clientId, p.content);
          continue;
        }
      }
      if (normal) {
        normal.content = transformPresence(
          clientId,
          normal.content,
          ops,
          clientIds,
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

  syncPresence(presenceClientId: string, presence: Presence<Pr>) {
    const { doc } = this;
    if (presence.version > doc.version) {
      return;
    }
    let transformOps;
    let clientIds;
    if (presence.version === doc.version) {
      transformOps = doc.allPendingOps.map((o) => o.op.content);
      clientIds = transformOps.map(() => doc.clientId);
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

      clientIds = serverOps
        .map((o) => o.clientId)
        .slice(i)
        .concat(doc.allPendingOps.map(() => doc.clientId));
    }
    presence.content = transformPresence(
      presenceClientId,
      presence.content!,
      transformOps,
      clientIds,
      doc.otType,
    );
    return presence;
  }
}
