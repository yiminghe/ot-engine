import { insertOp, moveOp } from 'ot-tree';
import { TreePresence } from 'ot-tree';
import { doc } from './doc';
import { TreeNode, Model, Operation, ExpandInfo } from './types';
import {
  getPathFromIdPath,
  getIdsByDescendentsAndSelf,
  getNodeAtPath,
  transformLowerSiblingCountsToPath,
  transformNewPathToOldPath,
  uuidv4,
  getParentsAndSelfAtNodePath,
  getIdPathFromPath,
  last,
} from './utils';

export const model = {
  state: {
    treeData: [],
  },
  reducers: {
    set(rootState: any, data: any) {
      return {
        treeData: data,
      };
    },
  },
  effects: (dispatch: any) => ({
    onOp(opss: Operation[][], rootState: any) {
      const { treeData } = rootState.model as Model;
      for (const ops of opss) {
        for (const op of ops) {
          let removedNode;
          if (op.type === 'remove_node') {
            const { path } = op;
            removedNode = getNodeAtPath(path, treeData);
            const nodeIds = getIdsByDescendentsAndSelf(removedNode as TreeNode);

            const deleted: Record<string, null> = {};
            for (const n of nodeIds) {
              deleted[n] = null;
            }
            dispatch.app.updateExpand(deleted);
          }
        }
      }
    },
  }),
};

export const app = {
  state: {
    expand: {},
    selectedPath: [],
    selectedId: '',
    remoteSelected: {},
  },
  reducers: {
    doUpdateRemoteSelected(
      rootState: { remoteSelected: any },
      remoteSelected: any,
    ) {
      return {
        ...rootState,
        remoteSelected,
      };
    },
    updateSelectedPath(
      rootState: { selectedPath: number[] },
      payload: { selectedPath: number[]; selectedId: string },
    ) {
      return {
        ...rootState,
        ...payload,
      };
    },
    updateExpand(rootState: { expand: ExpandInfo }, payload: any) {
      const keys = Object.keys(payload);
      let changed = false;
      let { expand } = rootState;
      for (const k of keys) {
        if (payload[k] === null) {
          if (expand[k] !== undefined) {
            if (!changed) {
              changed = true;
              expand = { ...expand };
            }

            delete expand[k];
          }
        } else {
          if (!changed) {
            changed = true;
            expand = { ...expand };
          }
          expand[k] = payload[k];
        }
      }
      return changed ? { ...rootState, expand } : rootState;
    },
  },
  effects: (dispatch: any) => ({
    onPresence(presence: any, rootState: any) {
      const selectedPath = presence?.path || [];
      const selectedId = selectedPath.length
        ? last(getIdPathFromPath(selectedPath, rootState.model.treeData))
        : '';

      dispatch.app.updateSelectedPath({
        selectedId,
        selectedPath,
      });
    },
    updateRemoteSelected(payload: Map<string, TreePresence>, rootState: any) {
      const { remoteSelected } = rootState.app;
      for (const clientId of Array.from(payload.keys())) {
        const path = payload.get(clientId)?.path;
        for (const nodeId of Object.keys(remoteSelected)) {
          const clients = remoteSelected[nodeId];
          const index = clients.indexOf(clientId);
          if (index !== -1) {
            clients.splice(index, 1);
          }
        }
        if (path && path.length) {
          const id = last(getIdPathFromPath(path, rootState.model.treeData));
          remoteSelected[id] = remoteSelected[id] || [];
          remoteSelected[id].push(clientId);
        }
      }
      dispatch.app.doUpdateRemoteSelected(remoteSelected);
    },
    moveNode(arg: any, rootState: any) {
      const { treeData } = rootState.model;
      const newTreeData = arg.treeData;
      const fromPath = getPathFromIdPath(arg.prevPath, treeData);
      let toPath = getPathFromIdPath(arg.nextPath, newTreeData);

      if (String(fromPath) === String(toPath)) {
        return;
      }

      const parents = getParentsAndSelfAtNodePath(
        toPath.slice(0, -1),
        arg.treeData,
      );

      // transform relative to current tree path
      toPath = transformNewPathToOldPath(
        toPath,
        fromPath,
        newTreeData,
        treeData,
      );

      doc.submitOp(moveOp(fromPath, toPath));

      if (parents.length) {
        const map: Record<string, true> = {};
        for (const p of parents) {
          map[p.data.id] = true;
        }
        dispatch.app.updateExpand(map);
      }
    },
    addNode(lowerSiblingCounts: number[], rootState: any) {
      const id = uuidv4();
      const { treeData } = rootState.model;
      const path = transformLowerSiblingCountsToPath(
        lowerSiblingCounts.concat(-1),
        treeData,
      );
      const parent = getNodeAtPath(path.slice(0, -1), treeData);
      if (parent) {
        dispatch.app.updateExpand({
          [parent.data.id]: true,
        });
      }

      let text = window.prompt('名字') || '';
      text = text || id.slice(-5);

      doc.submitOp(
        insertOp(path, {
          data: {
            id,
            name: text, //`${text}_${id}`.slice(0, 10),
          },
          children: [],
        }),
      );
    },
  }),
};

export const models = { model, app };
