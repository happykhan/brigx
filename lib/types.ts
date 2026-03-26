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
    alignerVersion: string;
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

export interface RingData {
  queryId: string;
  queryName: string;
  color: string;
  visible: boolean;
  hits: AlignmentHit[]; // Raw alignment hits for direct rendering
  annotations?: Annotation[]; // Custom annotations for this ring
  customWidth?: number; // Optional custom width override
  alignmentOutput?: string; // Raw alignment output for download
  graphPoints?: GraphPoint[]; // Graph ring data (from .graph or .sam files)
  graphMaxValue?: number; // Maximum value for graph ring scaling
  graphMaxCap?: number; // User-set cap: values above shown in blue
  graphStats?: { mean: number; q3: number; max: number }; // Summary stats for graph data
  upperThreshold?: number; // Per-ring upper identity threshold (default: 90)
  lowerThreshold?: number; // Per-ring lower identity threshold (default: 70)
  showLabels?: boolean; // Show annotation labels on the ring (default: true)
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
export type AnnotationShape = 'arrow-forward' | 'arrow-reverse' | 'block' | 'arc' | 'hidden';

export interface Annotation {
  id: string;
  start: number;
  end: number;
  label: string;
  shape: AnnotationShape;
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

// Contig boundary for multi-FASTA reference visualization
export interface ContigBoundary {
  name: string;
  start: number; // 0-based position in merged sequence
  end: number;
  index: number;
}

export interface CircularPlotData {
  reference: {
    name: string;
    length: number;
    gcContent?: number[];
    gcSkew?: number[];
    features?: Feature[];
    contigs?: ContigBoundary[]; // Contig boundaries for multi-FASTA reference
  };
  rings: RingData[];
  config: {
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
  minIdentity: number;
  minAlignmentLength: number;
  colorScheme: string;
  forceAlignment: boolean;
  alignerOptions?: string;
  spacerSize?: number; // Spacer between sequences in multi-FASTA reference (default: 0)
  blastProgram?: 'blastn' | 'blastx'; // BLAST program (default: blastn)
  showGCContent?: boolean; // Show GC content ring (default: true)
  showGCSkew?: boolean; // Show GC skew ring (default: true)
}

// Graph ring data (for .graph files - coverage, expression, etc.)
export interface GraphPoint {
  start: number;
  end: number;
  value: number;
}

export interface GraphRingData {
  queryId: string;
  queryName: string;
  color: string;
  visible: boolean;
  points: GraphPoint[];
  maxValue: number;
  isGraphRing: true;
  annotations?: Annotation[];
  statistics: {
    meanIdentity: number;
    genomeCoverage: number;
    totalAlignedBases: number;
  };
}

export interface RingConfig {
  id: string;
  legendText: string;
  files: File[];
  color: string;
  upperThreshold: number;
  lowerThreshold: number;
  customWidth?: number; // Optional custom width for this ring
  blastType?: 'blastn' | 'blastx'; // Per-ring BLAST program (default: blastn)
  showLabels?: boolean; // Show annotation labels on ring (default: true)
  graphMaxCap?: number; // Cap graph values at this maximum (values above shown in blue)
}

export interface ProgressUpdate {
  step: string;
  percent: number;
  message?: string;
  partialData?: Partial<CircularPlotData>; // For progressive rendering
}
