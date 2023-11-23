const { version } = require('../../../scripts/build');
const fs = require('fs-extra');
const { execSync } = require('child_process');
const path = require('path');
function r(...p) {
  return path.join(__dirname, ...p);
}

execSync('rm -rf ' + r('../pkg'), { stdio: 'inherit' });

fs.mkdirSync(r('../pkg'));

const pkg = require(r('../package.json'));

delete pkg.devDependencies;
delete pkg.scripts;
const { dependencies } = pkg;
pkg.version = version;
for (const d of Object.keys(dependencies)) {
  if (dependencies[d] === 'workspace:*') {
    dependencies[d] = version;
  }
}

fs.writeFileSync(r('../pkg/package.json'), JSON.stringify(pkg, null, 2));

fs.copyFileSync(r('../../../README.md'), r('../pkg', 'README.md'));

const cwd = r('../');

execSync(`cp *.{js,ts} pkg`, {
  stdio: 'inherit',
  cwd,
});
