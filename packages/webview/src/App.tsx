import React, { useEffect, useRef } from 'react';
import { Edge, Network, Node } from 'vis-network';
import { DataSet } from 'vis-data';

const App: React.FC = () => {
    // Referência para a div onde o vis-network vai desenhar o grafo
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Criação dos nós de teste
        const nodes = new DataSet<Node>([
            { id: 1, label: 'Head', color: '#4ec9b0', font: { color: 'black' }, shape: 'box' },
            { id: 2, label: 'Nó 1', color: '#4ec9b0', font: { color: 'black' }, shape: 'box' },
            { id: 3, label: 'Nó 2\n(NULL)', color: '#4ec9b0', font: { color: 'black' }, shape: 'box' }
        ]);

        // Criação das arestas de teste
        const edges = new DataSet<Edge>([
            { from: 1, to: 2, arrows: 'to', color: '#ffffff' },
            { from: 2, to: 3, arrows: 'to', color: '#ffffff' }
        ]);

        // Configuração do Grafo
        const data = { nodes, edges };
        const options = {
            physics: {
                enabled: true,
                barnesHut: { springLength: 100 }
            }
        };

        // Injeta o grafo na div
        const network = new Network(containerRef.current, data, options);

        // Limpeza quando o componente for desmontado
        return () => {
            network.destroy();
        };
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '10px', backgroundColor: '#252526', borderBottom: '1px solid #333' }}>
                <h3 style={{ margin: 0, textAlign: 'center' }}>DbgAlgo - Estrutura de Dados</h3>
            </div>

            {/* "Jaula" do Grafo: position relative com flex: 1.
                Isso impede o loop infinito de redimensionamento do canvas.
            */}
            <div style={{ flex: 1, position: 'relative' }}>
                <div
                    ref={containerRef}
                    style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                        outline: 'none'
                    }}
                />
            </div>
        </div>
    );
};

export default App;