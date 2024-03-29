// @ts-ignore
import Quill from 'quill';

// @ts-ignore
import QuillCursors from 'quill-cursors';

import 'quill/dist/quill.bubble.css';
// @ts-ignore
import tinycolor from 'tinycolor2';
import { doc } from './doc';
import './style.css';

Quill.register('modules/cursors', QuillCursors);

const nameInput = document.getElementById('name') as HTMLInputElement;

const colors: Record<string, string> = {};

doc.fetch().then(() => {
  const { remotePresences } = doc;
  initialiseQuill(remotePresences);
});

function initialiseQuill(remotePresences: Map<string, any>) {
  const undo = document.getElementById('undo') as HTMLButtonElement;
  const redo = document.getElementById('redo') as HTMLButtonElement;

  undo.addEventListener('click', () => {
    doc.undo();
  });

  redo.addEventListener('click', () => {
    doc.redo();
  });

  const quill = new Quill('#editor', {
    theme: 'bubble',
    modules: {
      cursors: true,
      history: { maxStack: 0, userOnly: true },
    },
  });
  const cursors = quill.getModule('cursors');

  quill.setContents(doc.data);

  quill.on('text-change', function (delta: any, oldDelta: any, source: any) {
    if (source !== 'user') return;
    doc.submitOp(delta);
  });

  doc.addEventListener('op', function ({ ops, source, undoRedo }) {
    if (source) {
      undo.disabled = !doc.canUndo();
      redo.disabled = !doc.canRedo();
      if (!undoRedo) {
        return;
      }
    }
    for (const op of ops) {
      quill.updateContents(op);
    }
  });

  quill.on(
    'selection-change',
    function (range: any, oldRange: any, source: any) {
      // We only need to send updates if the user moves the cursor
      // themselves. Cursor updates as a result of text changes will
      // automatically be handled by the remote client.
      if (source !== 'user') return;
      // Ignore blurring, so that we can see lots of users in the
      // same window. In real use, you may want to clear the cursor.
      if (!range) return;
      // In this particular instance, we can send extra information
      // on the presence object. This ability will vary depending on
      // type.
      range.name = nameInput.value;
      doc.submitPresence(range);
    },
  );

  function updateRemotePresence(presences: Map<string, any>) {
    for (const id of Array.from(presences.keys())) {
      const range: any = presences.get(id)!;
      if (!range) {
        cursors.removeCursor(id);
        continue;
      }
      colors[id] = colors[id] || tinycolor.random().toHexString();
      const name = range.name || 'Anonymous';
      cursors.createCursor(id, name, colors[id]);
      cursors.moveCursor(id, range);
    }
    document.getElementById('count')!.innerHTML = `${doc.remotePresences.size}`;
  }

  if (remotePresences.size) {
    updateRemotePresence(remotePresences);
  }

  doc.addEventListener('remotePresence', (e) => {
    updateRemotePresence(e.changed);
  });

  doc.submitPresence({
    name: nameInput.value,
  });

  return quill;
}
