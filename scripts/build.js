const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

const version = '0.0.14';

exports.version = version;

exports.build = function (dirname) {
  function r(...p) {
    return path.join(dirname, ...p);
  }

  execSync('rm -rf ' + r('../pkg'), { stdio: 'inherit' });

  fs.mkdirSync(r('../pkg'));

  const pkg = require(r('../package.json'));

  delete pkg.exports;
  delete pkg.devDependencies;
  delete pkg.scripts;

  pkg.version = version;

  pkg.main = 'dist-node/index.js';
  pkg.module = 'dist-web/index.js';
  pkg.types = 'dist-types/index.d.ts';

  const { dependencies = {} } = pkg;

  for (const d of Object.keys(dependencies)) {
    if (dependencies[d] === 'workspace:*') {
      dependencies[d] = version;
    }
  }

  fs.writeFileSync(r('../pkg/package.json'), JSON.stringify(pkg, null, 2));

  fs.copyFileSync(r('../README.md'), r('../pkg', 'README.md'));
  const cwd = r('../');

  const bundleConfig = {
    bundle: true,
    minify: false,
    sourcemap: true,
    platform: 'node',
    mainFields: ['module', 'main'],

    entryPoints: [r('../src/index.ts')],

    packages: 'external',
  };

  esbuild.build({
    ...bundleConfig,
    format: 'cjs',
    outfile: r('../pkg/dist-node/index.js'),
  });

  esbuild.build({
    ...bundleConfig,
    format: 'esm',
    outfile: r('../pkg/dist-web/index.js'),
  });

  execSync(
    `tsc -d --declarationDir ./pkg/dist-types/ \
 --project ./tsconfig.build.json --target es2020 \
 --module esnext --emitDeclarationOnly --sourceMap false --rootDir src`,
    {
      stdio: 'inherit',
      cwd,
    },
  );
};
