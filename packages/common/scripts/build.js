const mark = '## ot-engine-common type definition';
const endMark = '## ot-engine/server type definition';
require('../../../scripts/build').build(__dirname, {
  mark,
  endMark,
});
