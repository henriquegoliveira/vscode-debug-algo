import { styles } from './RecursionView.styles';
import React from 'react';

export const Connector: React.FC<{ label: string }> = ({ label }) => (
  <div style={styles.connector}>
    <span style={styles.connectorLine} />
    <span style={styles.connectorLabel}>{label}</span>
    <span style={styles.connectorLine} />
  </div>
);
