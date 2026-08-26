import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { connectSnapshotChannel } from './channel';

const container = document.getElementById('root');

if (container) {
  connectSnapshotChannel();
  const root = createRoot(container);
  root.render(<App />);
} else {
  console.error('Elemento root não encontrado no HTML.');
}
