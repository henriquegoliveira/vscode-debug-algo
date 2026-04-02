const esbuild = require('esbuild');

// Verifica se o script foi chamado com a flag --watch (para modo de desenvolvimento)
const isWatch = process.argv.includes('--watch');

const buildOptions = {
  // Ponto de entrada do backend
  entryPoints: ['./src/extension.ts'],
  
  // Arquivo final empacotado
  outfile: './dist/extension.js',
  
  // Junta todas as dependências em um único arquivo
  bundle: true,
  
  // Define que o ambiente de execução é o Node.js
  platform: 'node',
  
  // Ignora o módulo vscode
  external: ['vscode'],
  
  // Minifica o código para economizar espaço
  minify: !isWatch,
  
  // Gera source maps para facilitar o debug (breakpoints no VS Code)
  sourcemap: true,
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

build().catch(() => process.exit(1));