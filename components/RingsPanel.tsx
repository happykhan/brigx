

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import RingConfiguration from '@/components/RingConfiguration';
import type { RingConfig, RingData } from '@/lib/types';

interface PanelFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PANEL_STORAGE_KEY = 'brigx-ring-panel-frame';
const PANEL_MARGIN = 12;
const PANEL_MIN_WIDTH = 380;
const PANEL_MIN_HEIGHT = 260;

function defaultPanelFrame(): PanelFrame {
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  const width = Math.min(720, viewportWidth - PANEL_MARGIN * 2);
  const height = Math.min(640, Math.max(PANEL_MIN_HEIGHT, Math.round(viewportHeight * 0.72)));
  return {
    x: Math.max(PANEL_MARGIN, viewportWidth - width - 32),
    y: Math.min(96, Math.max(PANEL_MARGIN, viewportHeight - height - PANEL_MARGIN)),
    width,
    height,
  };
}

function constrainPanelFrame(frame: PanelFrame): PanelFrame {
  if (typeof window === 'undefined') return frame;
  const maximumWidth = Math.max(PANEL_MIN_WIDTH, window.innerWidth - PANEL_MARGIN * 2);
  const maximumHeight = Math.max(PANEL_MIN_HEIGHT, window.innerHeight - PANEL_MARGIN * 2);
  const width = Math.min(Math.max(frame.width, PANEL_MIN_WIDTH), maximumWidth);
  const height = Math.min(Math.max(frame.height, PANEL_MIN_HEIGHT), maximumHeight);
  return {
    x: Math.min(Math.max(frame.x, PANEL_MARGIN), Math.max(PANEL_MARGIN, window.innerWidth - width - PANEL_MARGIN)),
    y: Math.min(Math.max(frame.y, PANEL_MARGIN), Math.max(PANEL_MARGIN, window.innerHeight - height - PANEL_MARGIN)),
    width,
    height,
  };
}

function storedPanelFrame(): PanelFrame {
  if (typeof window === 'undefined') return defaultPanelFrame();
  try {
    const stored = window.sessionStorage.getItem(PANEL_STORAGE_KEY);
    if (!stored) return defaultPanelFrame();
    const parsed = JSON.parse(stored) as Partial<PanelFrame>;
    if ([parsed.x, parsed.y, parsed.width, parsed.height].every(value => typeof value === 'number')) {
      return constrainPanelFrame(parsed as PanelFrame);
    }
  } catch {
    // Ignore stale or unavailable session storage.
  }
  return defaultPanelFrame();
}

interface RingsPanelProps {
  rings: RingConfig[];
  setRings: (rings: RingConfig[]) => void;
  onEditAnnotations: (ringId: string) => void;
  ringDataList?: RingData[];
}

export default function RingsPanel({ rings, setRings, onEditAnnotations, ringDataList }: RingsPanelProps) {
  const [panelVisible, setPanelVisible] = useState(true);
  const [floating, setFloating] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [mobileLayout, setMobileLayout] = useState(false);
  const [frame, setFrame] = useState<PanelFrame>(storedPanelFrame);
  const dragState = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const resizeState = useRef<{ pointerId: number; startX: number; startY: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const updateLayout = () => {
      setMobileLayout(query.matches);
      if (query.matches) {
        setFloating(false);
        setMinimised(false);
      }
    };
    updateLayout();
    query.addEventListener('change', updateLayout);
    return () => query.removeEventListener('change', updateLayout);
  }, []);

  useEffect(() => {
    const constrainToViewport = () => setFrame(current => constrainPanelFrame(current));
    window.addEventListener('resize', constrainToViewport);
    return () => window.removeEventListener('resize', constrainToViewport);
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(frame));
  }, [frame]);

  const startFloating = () => {
    setFrame(current => constrainPanelFrame(current));
    setFloating(true);
    setMinimised(false);
  };

  const handleHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!floating || minimised || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, input, label, select, textarea, a')) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - frame.x,
      offsetY: event.clientY - frame.y,
    };
  };

  const handleHeaderPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState.current || dragState.current.pointerId !== event.pointerId) return;
    setFrame(current => constrainPanelFrame({
      ...current,
      x: event.clientX - dragState.current!.offsetX,
      y: event.clientY - dragState.current!.offsetY,
    }));
  };

  const finishHeaderDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragState.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragState.current = null;
  };

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: frame.width,
      height: frame.height,
    };
  };

  const handleResizePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const resize = resizeState.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    setFrame(current => constrainPanelFrame({
      ...current,
      width: resize.width + event.clientX - resize.startX,
      height: resize.height + event.clientY - resize.startY,
    }));
  };

  const finishResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (resizeState.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeState.current = null;
  };

  if (!panelVisible) {
    return (
      <div className="rings-panel-restore">
        <button type="button" className="btn-secondary text-xs" onClick={() => setPanelVisible(true)}>
          Show Ring Configuration
        </button>
      </div>
    );
  }

  const effectiveFloating = floating && !mobileLayout;
  const panelControls = (
    <div className="rings-panel-controls" aria-label="Ring panel controls">
      {effectiveFloating ? (
        <>
          <button type="button" onClick={() => { setFloating(false); setMinimised(false); }}>Dock</button>
          <button type="button" onClick={() => setMinimised(value => !value)}>{minimised ? 'Restore' : 'Minimise'}</button>
        </>
      ) : !mobileLayout ? (
        <button type="button" onClick={startFloating}>Float panel</button>
      ) : null}
      <button type="button" onClick={() => setPanelVisible(false)}>Close</button>
    </div>
  );

  return (
    <div
      className={`card rings-panel${effectiveFloating ? ' is-floating' : ' is-docked'}${minimised ? ' is-minimised' : ''}`}
      style={effectiveFloating ? {
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: minimised ? undefined : frame.height,
      } : undefined}
      data-testid="rings-panel"
    >
      <div className={effectiveFloating && !minimised ? 'rings-panel-scroll-area' : undefined}>
        <RingConfiguration
          rings={rings}
          setRings={setRings}
          onEditAnnotations={onEditAnnotations}
          ringDataList={ringDataList}
          panelControls={panelControls}
          panelMinimised={minimised}
          panelFloating={effectiveFloating}
          onPanelHeaderPointerDown={handleHeaderPointerDown}
          onPanelHeaderPointerMove={handleHeaderPointerMove}
          onPanelHeaderPointerUp={finishHeaderDrag}
          onPanelHeaderPointerCancel={finishHeaderDrag}
        />
      </div>
      {effectiveFloating && !minimised && (
        <button
          type="button"
          className="rings-panel-resize-handle"
          aria-label="Resize Ring Configuration panel"
          title="Resize panel"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={finishResize}
          onPointerCancel={finishResize}
        />
      )}
    </div>
  );
}
