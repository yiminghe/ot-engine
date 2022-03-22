import fs from 'fs-extra';
import path from 'path';

const source = path.join(__dirname, '../README.md');
const to = path.join(__dirname, '../packages');
for (const p of ['engine']) {
  fs.cpSync(source, path.join(to, p, 'README.md'));
}
