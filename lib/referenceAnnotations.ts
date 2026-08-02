import type { Annotation, Feature } from './types';

/** Convert parsed reference features into the annotation model shared by both renderers. */
export function referenceFeaturesToAnnotations(features: readonly Feature[]): Annotation[] {
  return features.map((feature, index): Annotation => ({
    id: `ref-feat-${index}`,
    start: feature.start,
    end: feature.end,
    label: feature.name || feature.product || feature.type,
    shape: feature.strand === '+' ? 'arrow-forward' : 'arrow-reverse',
    color: feature.color || '#4a90e2',
  }));
}
