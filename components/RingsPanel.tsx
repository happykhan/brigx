

import RingConfiguration from '@/components/RingConfiguration';
import type { RingConfig, RingData } from '@/lib/types';

interface RingsPanelProps {
  rings: RingConfig[];
  setRings: (rings: RingConfig[]) => void;
  onEditAnnotations: (ringId: string) => void;
  ringDataList?: RingData[];
}

export default function RingsPanel({ rings, setRings, onEditAnnotations, ringDataList }: RingsPanelProps) {
  return (
    <div className="card">
      <p className="text-xs mb-3" style={{ color: 'var(--gx-text-muted)' }}>
        Each ring can contain sequence files, graph data or a custom feature overlay. Ring order runs from the inside out.
      </p>
      <RingConfiguration
        rings={rings}
        setRings={setRings}
        onEditAnnotations={onEditAnnotations}
        ringDataList={ringDataList}
      />
    </div>
  );
}
