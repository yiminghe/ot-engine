/* eslint-disable no-param-reassign */

import React, { useState } from 'react';
import SortableTree from 'react-sortable-tree';
import 'react-sortable-tree/style.css';
import {
  transformLowerSiblingCountsToPath,
  stopPropagation,
  transformToViewTree,
} from './utils';
import { useSelector, useDispatch } from 'react-redux';
import { doc } from './doc';

// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop() {}

export function App() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, forceRender] = useState(0);

  // 获取 model
  const model = useSelector((m: any) => {
    return m.model;
  });
  const dispatch: any = useDispatch();
  const app = useSelector((m: any) => m.app);

  return (
    <div style={{ padding: 10 }} onClick={stopPropagation}>
      <button
        onClick={() => {
          dispatch.app.addNode([]);
        }}
      >
        Add Root
      </button>{' '}
      &nbsp;
      <button
        disabled={!doc.canUndo()}
        onClick={() => {
          doc.undo();
        }}
      >
        Undo
      </button>{' '}
      &nbsp;
      <button
        disabled={!doc.canRedo()}
        onClick={() => {
          doc.redo();
        }}
      >
        Redo
      </button>{' '}
      &nbsp;
      <div style={{ overflow: 'auto', height: 440 }}>
        <SortableTree
          treeData={transformToViewTree(app.expand, model.treeData)}
          getNodeKey={({ node }: any) => node.id}
          onChange={noop}
          onMoveNode={(arg: any) => {
            dispatch.app.moveNode(arg);
            setTimeout(() => {
              forceRender((s: number) => ++s);
            }, 100);
          }}
          onVisibilityToggle={(arg: any) => {
            dispatch.app.updateExpand({
              [arg.node.id]: arg.expanded,
            });
          }}
          generateNodeProps={({
            node,
            lowerSiblingCounts,
          }: {
            node: any;
            path: any[];
            lowerSiblingCounts: number[];
          }) => ({
            title: node.data.name,
            buttons: [
              <button
                onClick={() => {
                  const name = window.prompt('名字') || '';
                  if (name) {
                    const path = transformLowerSiblingCountsToPath(
                      lowerSiblingCounts,
                      model.treeData,
                    );
                    doc.submitOp([
                      {
                        type: 'edit_node',
                        path,
                        data: {
                          name,
                        },
                        prevData: {
                          name: node.data.name,
                        },
                      },
                    ]);
                  }
                }}
              >
                Rename
              </button>,
              <div style={{ width: 10 }} />,
              <button
                onClick={() => {
                  dispatch.app.addNode(lowerSiblingCounts);
                }}
              >
                Add Child
              </button>,
              <div style={{ width: 10 }} />,
              <button
                onClick={() => {
                  const path = transformLowerSiblingCountsToPath(
                    lowerSiblingCounts,
                    model.treeData,
                  );
                  doc.submitOp([
                    {
                      type: 'remove_node',
                      removedNode: node,
                      path,
                    },
                  ]);
                }}
              >
                Remove
              </button>,
            ],
          })}
        />
      </div>
    </div>
  );
}
