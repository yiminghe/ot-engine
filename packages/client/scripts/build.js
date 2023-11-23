const mark = '## ot-engine/client type definition';
const endMark = '## dev';
require('../../../scripts/build').build(__dirname, {
  mark,
  endMark,
});
