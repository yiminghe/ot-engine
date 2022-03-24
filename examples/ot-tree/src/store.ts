import { init } from '@rematch/core';
import { models } from './models';
import { doc } from './doc';

export const store = init<any>({
  models,
});

const { model, app } = store.dispatch;

doc.fetch().then(() => {
  const doc2 = doc;
  model.set(doc2.data);
  const { remotePresences } = doc2;
  if (remotePresences.size) {
    app.updateRemoteSelected(remotePresences);
  }
});

doc.addEventListener('beforeOp', (e) => {
  console.log('before op', e.ops);
  model.onOp(e.ops);
});

doc.addEventListener('op', (e) => {
  console.log('apply op', e.ops);
  model.set(doc.data);
  app.onPresence(doc.presence);
});

doc.addEventListener('remotePresence', ({ changed }) => {
  app.updateRemoteSelected(changed);
});
