import HtmlWebpackPlugin from 'html-webpack-plugin';
import * as path from 'path';
import * as webpack from 'webpack';

// A tipagem 'Configuration' ajuda com o autocompletar das opções do Webpack
const config: webpack.Configuration = {
    // Define o modo de desenvolvimento. Para produção, mude para 'production'
    mode: 'development',

    // Ponto de entrada do seu aplicativo React
    entry: './src/index.tsx',

    output: {
        // Usa a propriedade ESM moderna no lugar do __dirname
        path: path.resolve(import.meta.dirname, 'dist'),
        filename: 'bundle.js',
        // Limpa a pasta dist antes de cada build
        clean: true,
    },

    resolve: {
        // Diz ao Webpack para resolver essas extensões automaticamente
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
    },

    module: {
        rules: [
            {
                test: /\.(ts|tsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        // Acelera o build do Webpack confiando a checagem de tipos apenas ao VS Code/tsc
                        transpileOnly: true,
                    },
                },
            },
            {
                // Regra para carregar CSS (caso você precise para o vis-network no futuro)
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },

    plugins: [
        new HtmlWebpackPlugin({
            title: 'DbgAlgo',
            template: './src/index.html'
        }),
    ],

    // Facilita a depuração de erros mapeando o código final para o seu TypeScript original
    devtool: 'inline-source-map',
};

export default config;