import {
  EditNodeOperation as OtEditNameOperation,
  InsertNodeOperation as OtInsertNodeOperation,
  MoveNodeOperation as OtMoveNodeOperation,
  Path as OtPath,
  RemoveNodeOperation as OtRemoveNodeOperation,
  TreeNode as OtTreeNode,
} from 'ot-tree';

type BaseTreeNode = {
  data: { name: string; id: string };
};

export type TreeNode = OtTreeNode &
  BaseTreeNode & {
    children: TreeNode[];
  };

export type Path = OtPath;

export type TreeData = TreeNode[];

export type ViewTreeNode = BaseTreeNode & {
  expanded?: boolean;
  children: ViewTreeNode[];
};

export interface InsertNodeOperation extends OtInsertNodeOperation {
  newNode: TreeNode;
}

export interface RemoveNodeOperation extends OtRemoveNodeOperation {
  removedNode?: TreeNode;
}

export type MoveNodeOperation = OtMoveNodeOperation;

export type EditNodeOperation = OtEditNameOperation;

export type Model = { treeData: TreeNode[] };

export type Operation =
  | InsertNodeOperation
  | RemoveNodeOperation
  | MoveNodeOperation
  | EditNodeOperation;

export type ExpandInfo = Record<string, boolean>;

export type State = { expand: ExpandInfo };
