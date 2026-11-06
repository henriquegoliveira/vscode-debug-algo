const esbuild = require('esbuild');
const { mkdirSync, readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');

const isWatch = process.argv.includes('--watch');

const outDir = resolve(__dirname, 'dist');
const htmlSource = resolve(__dirname, '../webview/src/index.html');

const CSP = [
  "default-src 'none'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'none'",
].join('; ');

mkdirSync(outDir, { recursive: true });

function writeHtml() {
  const html = readFileSync(htmlSource, 'utf8')
    .replace('%CSP%', CSP)
    .replace(' nonce="%NONCE%"', '')
    .replace('%BUNDLE%', 'bundle.js')
    .replace('<title>DebugAlgo</title>', '<title>DebugAlgo — interactive demo</title>');
  writeFileSync(resolve(outDir, 'index.html'), html);
}

const buildOptions = {
  entryPoints: ['./src/index.tsx'],
  outfile: resolve(outDir, 'bundle.js'),
  bundle: true,
  minify: !isWatch,
  sourcemap: isWatch ? 'inline' : false,
  format: 'esm',
  target: ['es2020'],
  loader: { '.tsx': 'tsx', '.ts': 'ts', '.svg': 'dataurl', '.c': 'text', '.json': 'json' },
  plugins: [{ name: 'demo-html', setup: (build) => build.onEnd(writeHtml) }],
};

async function build() {
  if (isWatch) {
    const context = await esbuild.context(buildOptions);
    await context.watch();
    console.log('Watching demo changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('Demo build completed successfully!');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
