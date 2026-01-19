// Processing Worker - Aggregates alignments into windows
import type { AlignmentHit, WindowData, RingData } from '../lib/types';

export function aggregateToWindows(
  alignments: AlignmentHit[],
  referenceLength: number,
  windowSize: number,
  minIdentity: number,
  minLength: number
): WindowData[] {
  const numWindows = Math.ceil(referenceLength / windowSize);
  const windows: WindowData[] = [];
  
  // Initialize windows
  for (let i = 0; i < numWindows; i++) {
    windows.push({
      start: i * windowSize,
      end: Math.min((i + 1) * windowSize, referenceLength),
      avgIdentity: 0,
      coverage: 0,
      hitCount: 0,
      maxIdentity: 0,
      strand: 'both'
    });
  }
  
  // Filter alignments
  const filtered = alignments.filter(
    hit => hit.percentIdentity >= minIdentity && hit.alignmentLength >= minLength
  );
  
  // Bin alignments into windows
  for (const hit of filtered) {
    const startWindow = Math.floor(hit.refStart / windowSize);
    const endWindow = Math.floor(hit.refEnd / windowSize);
    
    for (let w = startWindow; w <= endWindow && w < numWindows; w++) {
      const window = windows[w];
      const overlapStart = Math.max(window.start, hit.refStart);
      const overlapEnd = Math.min(window.end, hit.refEnd);
      const overlapLength = overlapEnd - overlapStart;
      
      if (overlapLength > 0) {
        const currentWeight = window.coverage * windowSize;
        const newWeight = overlapLength;
        
        if (window.hitCount === 0) {
          window.avgIdentity = hit.percentIdentity;
        } else {
          window.avgIdentity = (
            (window.avgIdentity * currentWeight + hit.percentIdentity * newWeight) /
            (currentWeight + newWeight)
          );
        }
        
        window.coverage = Math.min(1, window.coverage + overlapLength / windowSize);
        window.hitCount++;
        window.maxIdentity = Math.max(window.maxIdentity, hit.percentIdentity);
        
        if (window.strand === 'both') {
          window.strand = hit.strand;
        } else if (window.strand !== hit.strand) {
          window.strand = 'both';
        }
      }
    }
  }
  
  return windows;
}

function calculateStatistics(windows: WindowData[], referenceLength: number) {
  let totalIdentity = 0;
  let totalCoveredBases = 0;
  let windowCount = 0;
  
  for (const window of windows) {
    if (window.hitCount > 0) {
      totalIdentity += window.avgIdentity * window.coverage;
      totalCoveredBases += window.coverage * (window.end - window.start);
      windowCount++;
    }
  }
  
  return {
    meanIdentity: windowCount > 0 ? totalIdentity / windowCount : 0,
    genomeCoverage: (totalCoveredBases / referenceLength) * 100,
    totalAlignedBases: totalCoveredBases
  };
}

// Worker message handler
self.onmessage = (e: MessageEvent) => {
  const { type, alignments, referenceLength, windowSize, minIdentity, minLength, queryId, queryName, color } = e.data;
  
  try {
    if (type === 'process') {
      const windows = aggregateToWindows(
        alignments,
        referenceLength,
        windowSize,
        minIdentity,
        minLength
      );
      
      const statistics = calculateStatistics(windows, referenceLength);
      
      const ringData: RingData = {
        queryId,
        queryName,
        color,
        visible: true,
        windows,
        statistics
      };
      
      self.postMessage({ type: 'processed', ringData });
    }
  } catch (error: any) {
    self.postMessage({ type: 'error', error: error.message });
  }
};
