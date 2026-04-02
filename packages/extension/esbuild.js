const esbuild = require('esbuild');

// Verifica se o script foi chamado com a flag --watch (para modo de desenvolvimento)
const isWatch = process.argv.includes('--watch');

const buildOptions = {
  // Ponto de entrada do backend (seu código principal da extensão)
  entryPoints: ['./src/extension.ts'],
  
  // Arquivo final empacotado
  outfile: './dist/extension.js',
  
  // Junta todas as dependências em um único arquivo
  bundle: true,
  
  // Define que o ambiente de execução é o Node.js (não o navegador!)
  platform: 'node',
  
  // Ignora o módulo 'vscode', pois ele já é fornecido nativamente pela IDE em tempo de execução
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
    console.log('Observando mudanças no código da extensão...');
  } else {
    await esbuild.build(buildOptions);
    console.log('Build da extensão concluído com sucesso!');
  }
}

build().catch(() => process.exit(1));