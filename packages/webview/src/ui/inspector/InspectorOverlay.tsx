import { styles } from './InspectorOverlay.styles';
import { AnnotateSection, annotationPrefill } from './AnnotateSection';
import { CardBody } from './CardBody';
import { LabelFields } from './LabelFields';
import { NodeBody, heading } from './NodeBody';
import { RootBody } from './RootBody';
import { TerminalBody } from './TerminalBody';
import type { Props } from './types';
import React from 'react';

const InspectorOverlay: React.FC<Props> = ({
  inspection,
  embedded,
  fields,
  onFieldChoice,
  onAnnotate,
  onSelect,
  onClose,
}) => (
  <aside style={styles.overlay}>
    <header style={styles.head}>
      <span style={styles.title}>{heading(inspection)}</span>
      <button
        type="button"
        className="dbga-icon"
        style={styles.close}
        title="Fechar (Esc)"
        onClick={onClose}
      >
        &#10005;
      </button>
    </header>

    {inspection.space === 'node' && <NodeBody inspection={inspection} onSelect={onSelect} />}
    {inspection.space === 'node' && inspection.recordType !== null && (
      <LabelFields
        type={inspection.recordType}
        names={inspection.labelNames}
        auto={inspection.labelAuto}
        choice={fields[inspection.recordType]}
        embedded={embedded}
        onChoice={onFieldChoice}
      />
    )}
    {inspection.space === 'terminal' && (
      <TerminalBody inspection={inspection} onSelect={onSelect} />
    )}
    {inspection.space === 'root' && <RootBody inspection={inspection} onSelect={onSelect} />}
    {inspection.space === 'card' && <CardBody inspection={inspection} onSelect={onSelect} />}

    <AnnotateSection
      key={annotationPrefill(inspection)}
      prefill={annotationPrefill(inspection)}
      embedded={embedded}
      onAnnotate={onAnnotate}
    />
  </aside>
);

export default InspectorOverlay;
