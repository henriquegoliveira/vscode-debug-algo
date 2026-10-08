const esbuild = require('esbuild');
const { mkdirSync } = require('fs');
const { resolve } = require('path');

const isWatch = process.argv.includes('--watch');
const isTests = process.argv.includes('--tests');
const outDir = resolve(__dirname, 'dist');

mkdirSync(outDir, { recursive: true });

const buildOptions = {
  entryPoints: ['./src/extension.ts'],
  outfile: './dist/extension.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: ['node20'],
  external: ['vscode', 'bufferutil', 'utf-8-validate'],
  minify: !isWatch,
  sourcemap: true,
  loader: { '.ts': 'ts' },
};

const testOptions = {
  entryPoints: ['./test/integration/*.test.ts'],
  outdir: './out/test/integration',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: ['node20'],
  external: ['vscode'],
  sourcemap: true,
};

async function build() {
  if (isTests) {
    await esbuild.build(testOptions);
    console.log('Integration tests build completed successfully!');
  } else if (isWatch) {
    const context = await esbuild.context(buildOptions);
    await context.watch();
    console.log('Watching extension changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('Extension build completed successfully!');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
