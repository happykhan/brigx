

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
      <RingConfiguration
        rings={rings}
        setRings={setRings}
        onEditAnnotations={onEditAnnotations}
        ringDataList={ringDataList}
      />
    </div>
  );
}
