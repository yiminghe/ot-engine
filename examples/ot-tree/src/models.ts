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
  },
  reducers: {
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
      return changed ? { expand } : rootState;
    },
  },
  effects: (dispatch: any) => ({
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

      doc.submitOp([
        {
          type: 'move_node',
          fromPath,
          toPath,
        },
      ]);

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
      text = text || id.slice(0, 10);

      doc.submitOp([
        {
          type: 'insert_node',
          path,
          newNode: {
            data: {
              id,
              name: text, //`${text}_${id}`.slice(0, 10),
            },
            children: [],
          },
        },
      ]);
    },
  }),
};

export const models = { model, app };
