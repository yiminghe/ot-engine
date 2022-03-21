import { init } from '@rematch/core';
import { models } from './models';
import { doc } from './doc';

export const store = init<any>({
  models,
});

doc.fetch().then(() => {
  const doc2 = doc;
  store.dispatch.model.set(doc2.data);
});

doc.addEventListener('op', (e) => {
  console.log('apply op', e.ops);
  const doc2 = doc;
  store.dispatch.model.set(doc2.data);
  store.dispatch.model.onOp(e.ops);
});