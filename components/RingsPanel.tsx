

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
        Reference features belong in the Reference Genome card. Ring overlays are optional highlights tied to an individual query ring.
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
