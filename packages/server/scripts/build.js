const mark = '## ot-engine/server type definition';
const endMark = '## ot-engine/client type definition';
require('../../../scripts/build').build(__dirname, {
  mark,
  endMark,
});
