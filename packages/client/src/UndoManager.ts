import { Op, transformType, last } from 'ot-engine-common';
import { Doc } from './doc';
import { PendingOp, RemoteOpEvent } from './types';

export interface UndoRedoItem<P> {
  op: Op<P>;
  accepted: boolean;
  invert: Op<P>;
  afterOps: any[];
}

export class UndoRedoStack<S, P, Pr> {
  stack: UndoRedoItem<P>[] = [];
  nextAcceptedIndex = 0;

  constructor(private doc: Doc<S, P, Pr>) {}

  onRemoteOp({ prevOps, sourceOp, afterOps }: RemoteOpEvent<P>) {
    const { stack } = this;
    let { nextAcceptedIndex } = this;
    if (nextAcceptedIndex && prevOps) {
      stack[nextAcceptedIndex - 1].afterOps.push(
        ...prevOps.map((o) => o.content),
      );
    }
    if (sourceOp && stack[nextAcceptedIndex]?.op.id === sourceOp.id) {
      stack[nextAcceptedIndex].accepted = true;
      nextAcceptedIndex = ++this.nextAcceptedIndex;
    }
    if (afterOps && nextAcceptedIndex) {
      stack[nextAcceptedIndex - 1].afterOps.push(
        ...afterOps.map((o) => o.content),
      );
    }
  }

  push(item: PendingOp<P>) {
    this.stack.push({
      ...item,
      accepted: false,
      afterOps: [],
    });
    if (this.stack.length > this.doc.config.undoStackLimit) {
      this.stack.shift();
      this.reduceNextAcceptedIndex();
    }
  }

  get length() {
    return this.stack.length;
  }

  reduceNextAcceptedIndex() {
    if (this.nextAcceptedIndex) {
      this.nextAcceptedIndex--;
    }
  }

  pop(): PendingOp<P> & { needInvert: boolean } {
    this.reduceNextAcceptedIndex();
    const item = this.stack.pop()!;
    let needInvert = false;
    if (item.accepted && item.afterOps.length) {
      needInvert = true;
      const [newContent, newNext] = transformType(
        [item.invert.content],
        item.afterOps,
        this.doc.otType,
      );
      item.invert.content = newContent[0];
      const lastItem = last(this.stack);
      if (lastItem) {
        lastItem.afterOps.push(...newNext);
      }
    }
    return {
      needInvert,
      op: item.invert,
      invert: item.op,
    };
  }

  clear() {
    this.nextAcceptedIndex = 0;
    this.stack = [];
  }
}
export class UndoManager<S, P, Pr> {
  undoStack: UndoRedoStack<S, P, Pr>;
  redoStack: UndoRedoStack<S, P, Pr>;

  constructor(private doc: Doc<S, P, Pr>) {
    doc.addEventListener('remoteOp', this.onRemoteOp);
    this.undoStack = new UndoRedoStack(doc);
    this.redoStack = new UndoRedoStack(doc);
  }

  onRemoteOp = (e: RemoteOpEvent<P>) => {
    this.undoStack.onRemoteOp(e);
    this.redoStack.onRemoteOp(e);
  };

  submitOp(pendingOp: PendingOp<P>) {
    this.undoStack.push(pendingOp);
    this.redoStack.clear();
  }

  canUndo() {
    return !!this.undoStack.length;
  }

  canRedo() {
    return !!this.redoStack.length;
  }

  undoRedo(
    popStack: UndoRedoStack<S, P, Pr>,
    pushStack: UndoRedoStack<S, P, Pr>,
  ) {
    const pendingOp = popStack.pop()!;
    pushStack.push(pendingOp);
    if (pendingOp.needInvert) {
      pendingOp.invert.content = this.doc.apply(pendingOp.op.content, true);
    }
    this.doc.submitPendingOp(pendingOp);
  }

  undo() {
    this.undoRedo(this.undoStack, this.redoStack);
  }

  redo() {
    this.undoRedo(this.redoStack, this.undoStack);
  }
}
