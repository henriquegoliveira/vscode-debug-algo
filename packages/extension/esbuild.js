const esbuild = require('esbuild');
const { mkdirSync } = require('fs');
const { resolve } = require('path');

const isWatch = process.argv.includes('--watch');
const outDir = resolve(__dirname, 'dist');

// Garante que a pasta dist exista antes do início da compilação
mkdirSync(outDir, { recursive: true });

const buildOptions = {
  entryPoints: ['./src/extension.ts'],
  outfile: './dist/extension.js',
  bundle: true,
  platform: 'node',
  // Define CommonJS para o VS Code extension host
  format: 'cjs',
  // Node 20 (VS Code ^1.95.0 usa Node 20 runtime)
  target: ['node20'],
  external: ['vscode'],
  minify: !isWatch,
  sourcemap: true,
  loader: { '.ts': 'ts' },
};

async function build() {
  if (isWatch) {
    const context = await esbuild.context(buildOptions);
    await context.watch();
    console.log('Observando mudancas no codigo da extensao...');
  } else {
    await esbuild.build(buildOptions);
    console.log('Build da extensao concluido com sucesso!');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
