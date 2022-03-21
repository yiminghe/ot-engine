import {
  Path as OtPath,
  TreeNode as OtTreeNode,
  InsertNodeOperation as OtInsertNodeOperation,
  MoveNodeOperation as OtMoveNodeOperation,
  RemoveNodeOperation as OtRemoveNodeOperation,
  EditNodeOperation as OtEditNameOperation,
} from 'ot-tree';

type BaseTreeNode = {
  data: { name: string };
};

export type TreeNode = OtTreeNode &
  BaseTreeNode & {
    id: string;
    children: TreeNode[];
  };

export type Path = OtPath;

export type JsonTreeNode = BaseTreeNode & {
  children: JsonTreeNode[];
};

export type TreeData = TreeNode[];

export type ViewTreeNode = BaseTreeNode & {
  id: string;
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
