import type { AnnotationTarget, Inspection } from '../../model/inspection';
import type { FieldChoice } from '../../session/persistence';

export interface Props {
  inspection: Inspection;
  annotations: AnnotationTarget[];
  embedded: boolean;
  fields: Record<string, FieldChoice>;
  onFieldChoice: (type: string, choice: FieldChoice | undefined) => void;
  onAnnotate: (annotation: string) => boolean;
  onSelect: (canvasId: string) => void;
  onClose: () => void;
}

export type Select = Props['onSelect'];
