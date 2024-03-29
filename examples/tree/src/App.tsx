/* eslint-disable no-param-reassign */

import { editOp, removeOp } from 'ot-tree';
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import SortableTree from 'react-sortable-tree';
import 'react-sortable-tree/style.css';
import { doc } from './doc';
import {
  stopPropagation,
  transformLowerSiblingCountsToPath,
  transformToViewTree,
} from './utils';

function noop() {}

export function App() {
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
        type="button"
        onClick={() => {
          dispatch.app.addNode([]);
        }}>
        Add Root
      </button>{' '}
      &nbsp;
      <button
        type="button"
        disabled={!doc.canUndo()}
        onClick={() => {
          doc.undo();
        }}>
        Undo
      </button>{' '}
      &nbsp;
      <button
        type="button"
        disabled={!doc.canRedo()}
        onClick={() => {
          doc.redo();
        }}>
        Redo
      </button>{' '}
      &nbsp;
      <div style={{ overflow: 'auto', height: 440 }}>
        <SortableTree
          treeData={transformToViewTree(app.expand, model.treeData)}
          getNodeKey={({ node }: any) => node.data.id}
          onChange={noop}
          onMoveNode={(arg: any) => {
            dispatch.app.moveNode(arg);
            setTimeout(() => {
              forceRender((s: number) => s + 1);
            }, 100);
          }}
          onVisibilityToggle={(arg: any) => {
            dispatch.app.updateExpand({
              [arg.node.data.id]: arg.expanded,
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
              <span style={{ border: '1px solid red' }}>
                selected clients:
                {app.remoteSelected[node.data.id]
                  ?.map((o: string) => o.slice(-5))
                  .join(',')}
              </span>,
              <div style={{ width: 10 }} />,
              <button
                type="button"
                onClick={() => {
                  const path =
                    app.selectedId === node.data.id
                      ? []
                      : transformLowerSiblingCountsToPath(
                          lowerSiblingCounts,
                          model.treeData,
                        );
                  doc.submitPresence({ path });
                  dispatch.app.updateSelectedPath({
                    selectedPath: path,
                    selectedId:
                      app.selectedId === node.data.id ? '' : node.data.id,
                  });
                }}>
                {app.selectedId === node.data.id ? 'unselect' : 'select'}
              </button>,
              <div style={{ width: 10 }} />,
              <button
                type="button"
                onClick={() => {
                  const name = window.prompt('名字') || '';
                  if (name) {
                    const path = transformLowerSiblingCountsToPath(
                      lowerSiblingCounts,
                      model.treeData,
                    );
                    doc.submitOp(editOp(path, { name }));
                  }
                }}>
                Rename
              </button>,
              <div style={{ width: 10 }} />,
              <button
                type="button"
                onClick={() => {
                  dispatch.app.addNode(lowerSiblingCounts);
                }}>
                Add Child
              </button>,
              <div style={{ width: 10 }} />,
              <button
                type="button"
                onClick={() => {
                  const path = transformLowerSiblingCountsToPath(
                    lowerSiblingCounts,
                    model.treeData,
                  );
                  doc.submitOp(removeOp(path));
                }}>
                Remove
              </button>,
            ],
          })}
        />
      </div>
    </div>
  );
}
