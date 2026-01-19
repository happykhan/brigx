// Data models and TypeScript interfaces for BRIG

export interface AlignmentHit {
  queryName: string;
  refStart: number;
  refEnd: number;
  queryStart: number;
  queryEnd: number;
  percentIdentity: number;
  alignmentLength: number;
  strand: '+' | '-';
  score?: number;
}

export interface AlignmentResult {
  queryId: string;
  queryName: string;
  queryLength: number;
  totalHits: number;
  hits: AlignmentHit[];
  metadata: {
    timestamp: number;
    lastzVersion: string;
    parameters: Record<string, any>;
  };
}

export interface AlignmentDataset {
  referenceId: string;
  referenceName: string;
  referenceLength: number;
  queries: AlignmentResult[];
  created: number;
}

export interface WindowData {
  start: number;
  end: number;
  avgIdentity: number;
  coverage: number;
  hitCount: number;
  maxIdentity: number;
  strand: '+' | '-' | 'both';
}

export interface RingData {
  queryId: string;
  queryName: string;
  color: string;
  visible: boolean;
  hits: AlignmentHit[]; // Raw alignment hits for direct rendering
  windows: WindowData[];
  annotations?: Annotation[]; // Custom annotations for this ring
  customWidth?: number; // Optional custom width override
  lastzOutput?: string; // Raw LASTZ output for download
  statistics: {
    meanIdentity: number;
    genomeCoverage: number;
    totalAlignedBases: number;
  };
}

export interface Feature {
  type: string;
  start: number;
  end: number;
  strand: '+' | '-';
  name?: string;
  product?: string;
  color?: string;
  attributes?: Record<string, string>;
}

// Custom annotations for rings
export interface Annotation {
  id: string;
  start: number;
  end: number;
  label: string;
  shape: 'arrow-forward' | 'arrow-reverse' | 'block';
  color?: string;
}

export interface RingAnnotations {
  ringId: string;
  annotations: Annotation[];
}

export interface AnnotationTrack {
  trackId: string;
  trackName: string;
  features: Feature[];
  style: {
    height: number;
    color: string;
    showLabels: boolean;
  };
}

export interface CircularPlotData {
  reference: {
    name: string;
    length: number;
    gcContent?: number[];
    gcSkew?: number[];
    features?: Feature[];
  };
  rings: RingData[];
  config: {
    windowSize: number;
    minIdentity: number;
    minAlignmentLength: number;
  };
}

export interface ParsedGenome {
  id: string;
  name: string;
  sequence: string;
  length: number;
  gcContent: number;
  isCircular: boolean;
  contigs?: Array<{ name: string; sequence: string }>;
}

export interface PipelineParams {
  windowSize: number;
  minIdentity: number;
  minAlignmentLength: number;
  colorScheme: string;
  forceAlignment: boolean;
}

export interface RingConfig {
  id: string;
  legendText: string;
  files: File[];
  color: string;
  upperThreshold: number;
  lowerThreshold: number;
  customWidth?: number; // Optional custom width for this ring
}

export interface ProgressUpdate {
  step: string;
  percent: number;
  message?: string;
  partialData?: Partial<CircularPlotData>; // For progressive rendering
}
