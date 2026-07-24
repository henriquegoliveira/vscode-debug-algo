const esbuild = require('esbuild');
const { copyFileSync, mkdirSync } = require('fs');
const { resolve, dirname } = require('path');

const isWatch = process.argv.includes('--watch');

const outDir = resolve(__dirname, 'dist');
const htmlFile = resolve(__dirname, 'src/index.html');
const outHtmlFile = resolve(outDir, 'index.html');

// Garante que a pasta dist exista antes de copiar
mkdirSync(outDir, { recursive: true });

const buildOptions = {
  entryPoints: ['./src/index.tsx'],
  outfile: './dist/bundle.js',
  bundle: true,
  minify: !isWatch,
  sourcemap: true,
  format: 'esm',
  target: ['es2020'],
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
  plugins: [
    {
      name: 'copy-html',
      setup(build) {
        build.onEnd(() => {
          copyFileSync(htmlFile, outHtmlFile);
          console.log('Copied index.html to dist/');
        });
      },
    },
  ],
};

async function build() {
  if (isWatch) {
    const context = await esbuild.context(buildOptions);
    await context.watch();
    console.log('Watching webview changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('Webview build completed successfully!');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
