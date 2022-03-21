import {
  ExpandInfo,
  JsonTreeNode,
  TreeNode,
  ViewTreeNode,
  TreeData,
  Path,
} from './types';
import { utils as pathUtils } from 'ot-tree';

export function last<O = any>(args: O[]) {
  return args && args[args.length - 1];
}

export function traverse(model: TreeNode, fn: (node: TreeNode) => boolean) {
  const ret = fn(model);
  if (ret) {
    return ret;
  }
  const { children } = model;
  if (children) {
    for (const c of children) {
      traverse(c, fn);
    }
  }
  return ret;
}

export function getIdsByDescendentsAndSelf(root: TreeNode) {
  const ret: string[] = [];
  traverse(root, (n: TreeNode) => {
    ret.push(n.id);
    return false;
  });
  return ret;
}

export function transformLowerSiblingCountsToPath(
  lowerSiblings: Path,
  treeData: TreeNode[],
) {
  const path: Path = [];
  let parent: TreeNode = { id: 'v', data: { name: 'v' }, children: treeData };
  for (const i of lowerSiblings) {
    const n = parent.children.length - i - 1;
    path.push(n);
    parent = parent.children[n];
  }
  return path;
}

export function getNodeAtPath(
  path: Path,
  treeData: TreeNode[],
): TreeNode | undefined {
  return pathUtils.getNodeAtPath(path, treeData) as TreeNode;
}

export function getParentsAndSelfAtNodePath(
  path: Path,
  tree: TreeNode[],
): TreeNode[] {
  if (!path.length) {
    return [];
  }
  let n = 0;
  const ret: TreeNode[] = [];
  let parent: TreeNode | undefined = {
    id: '',
    data: { name: '' },
    children: tree,
  };
  for (const i of path) {
    n = i;
    parent = parent.children && parent.children[n];
    if (!parent) {
      return ret;
    }
    ret.push(parent);
  }
  return ret;
}

export function stopPropagation(e: any) {
  e.stopPropagation();
}

let uid = 1;

export function uuidv4() {
  return `${++uid}`;
}

export function transformToTree(treeData: JsonTreeNode[]): TreeNode[] {
  const ret: TreeNode[] = [];
  for (const node of treeData) {
    const newNode: TreeNode = {
      data: node.data,
      id: uuidv4(),
      children: [],
    };
    newNode.children = transformToTree(node.children);
    ret.push(newNode);
  }
  return ret;
}

export function transformToJsonTree(treeData: TreeNode[]): JsonTreeNode[] {
  const ret: JsonTreeNode[] = [];
  for (const node of treeData) {
    const newNode: JsonTreeNode = {
      data: node.data,
      children: [],
    };
    newNode.children = transformToJsonTree(node.children);
    ret.push(newNode);
  }
  return ret;
}

export function transformToViewTree(
  expand: ExpandInfo,
  treeData: TreeNode[],
): ViewTreeNode[] {
  const ret: ViewTreeNode[] = [];
  for (const node of treeData) {
    const newNode: ViewTreeNode = {
      ...node,
    };
    if (expand[node.id]) {
      newNode.expanded = true;
    }
    newNode.children = transformToViewTree(expand, node.children);
    ret.push(newNode);
  }
  return ret;
}

function findIndexById(treeData: TreeNode[], id: string) {
  for (let i = 0, l = treeData.length; i < l; i++) {
    if (treeData[i].id === id) {
      return i;
    }
  }
  return -1;
}

export function getPathFromIdPath(idPath: string[], treeData: TreeNode[]) {
  let children = treeData;
  const path: Path = [];
  for (const id of idPath) {
    const index = findIndexById(children, id);
    path.push(index);
    children = children[index].children;
  }
  return path;
}

export function getIdPathFromPath(path: Path, treeData: TreeNode[]): string[] {
  if (!path.length) {
    [];
  }
  const ret = [];
  let parent: TreeNode = { id: 'v', data: { name: 'v' }, children: treeData };
  for (const i of path) {
    parent = parent.children[i];
    if (!parent) {
      return ret;
    }
    ret.push(parent.id);
  }
  return ret;
}

export function transformNewPathToOldPath(
  toPath: Path,
  fromPath: Path,
  newTreeData: TreeData,
  oldTreeData: TreeData,
) {
  if (pathUtils.isSibling(toPath, fromPath)) {
    return toPath;
  }
  if (last(toPath)) {
    const beforeNodePath = pathUtils.decrement(toPath);
    const beforeNodeIdPath = getIdPathFromPath(beforeNodePath, newTreeData);
    toPath = getPathFromIdPath(beforeNodeIdPath, oldTreeData);
    toPath = pathUtils.increment(toPath);
  } else if (toPath.length === 1) {
    // [0]
  } else {
    const parentNodePath = pathUtils.parent(toPath);
    const parentIdPath = getIdPathFromPath(parentNodePath, newTreeData);
    const parentPath = getPathFromIdPath(parentIdPath, oldTreeData);
    toPath = [...parentPath, 0];
  }
  return toPath;
}
