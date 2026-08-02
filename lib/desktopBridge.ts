import type {
  DesktopOpenedFile,
  DesktopRendererFileBinding,
  DesktopSaveProjectRequest,
} from '@/desktop/contracts';
import type { BRIGXSession } from './session';
import { createSession } from './session';
import type { Annotation, CircularPlotData, PipelineParams, RingConfig } from './types';
import type { ImagePropertiesConfig } from '@/components/ImageProperties';

const fileTokens = new WeakMap<File, string>();

export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && window.brigxDesktop !== undefined;
}

export function fileFromDesktop(opened: DesktopOpenedFile): File {
  const bytes = opened.bytes instanceof Uint8Array
    ? opened.bytes
    : new Uint8Array(opened.bytes);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const file = new File([buffer], opened.name, {
    type: opened.type,
    lastModified: opened.lastModified,
  });
  fileTokens.set(file, opened.token);
  return file;
}

export function restoreDesktopFiles(
  session: BRIGXSession,
  openedFiles: readonly DesktopOpenedFile[],
): { referenceFile: File | null; rings: RingConfig[] } {
  let referenceFile: File | null = null;
  const ringFiles = new Map<string, File[]>();

  for (const opened of openedFiles) {
    const file = fileFromDesktop(opened);
    if (opened.role === 'reference' && referenceFile === null) {
      referenceFile = file;
    } else if (opened.role === 'ring' && opened.ringId) {
      const files = ringFiles.get(opened.ringId) ?? [];
      files.push(file);
      ringFiles.set(opened.ringId, files);
    }
  }

  return {
    referenceFile,
    rings: session.rings.map(ring => ({
      id: ring.id,
      legendText: ring.legendText,
      color: ring.color,
      upperThreshold: ring.upperThreshold,
      lowerThreshold: ring.lowerThreshold,
      customWidth: ring.customWidth,
      blastType: ring.blastType,
      showLabels: ring.showLabels,
      graphMaxCap: ring.graphMaxCap,
      files: ringFiles.get(ring.id) ?? [],
    })),
  };
}

interface ProjectRequestState {
  appVersion: string;
  referenceFile: File | null;
  rings: readonly RingConfig[];
  ringAnnotations: Record<string, Annotation[]>;
  params: PipelineParams;
  imageProperties: ImagePropertiesConfig;
  referenceAnnotations: readonly Annotation[];
  plotData: CircularPlotData | null;
}

export function buildDesktopProjectRequest(
  state: ProjectRequestState,
  saveAs = false,
  timestamp = Date.now(),
): DesktopSaveProjectRequest {
  const session = createSession(
    state.appVersion,
    state.referenceFile?.name ?? '',
    state.rings,
    state.ringAnnotations,
    state.params,
    state.imageProperties,
    state.referenceAnnotations,
    timestamp,
  );
  return {
    sessionJson: JSON.stringify(session),
    ...(state.plotData ? { plotJson: JSON.stringify(state.plotData) } : {}),
    files: collectFileBindings(state.referenceFile, state.rings),
    saveAs,
  };
}

export function desktopProjectFingerprint(request: DesktopSaveProjectRequest): string {
  const files = request.files.map(binding => ({
    role: binding.role,
    ringId: binding.ringId,
    name: binding.file.name,
    size: binding.file.size,
    lastModified: binding.file.lastModified,
  }));
  return JSON.stringify({ session: JSON.parse(request.sessionJson), plot: request.plotJson, files });
}

function collectFileBindings(
  referenceFile: File | null,
  rings: readonly RingConfig[],
): DesktopRendererFileBinding[] {
  const bindings: DesktopRendererFileBinding[] = [];
  if (referenceFile) {
    bindings.push({
      role: 'reference',
      file: referenceFile,
      token: fileTokens.get(referenceFile),
    });
  }
  for (const ring of rings) {
    for (const file of ring.files) {
      bindings.push({
        role: 'ring',
        ringId: ring.id,
        file,
        token: fileTokens.get(file),
      });
    }
  }
  return bindings;
}
