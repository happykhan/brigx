import type { ReactNode } from "react";

import type { PlotTooltip } from "@/lib/rendering/types";

interface PlotTooltipContentProps {
  tooltip: PlotTooltip;
}

function TooltipHeading({ children }: { children: ReactNode }) {
  return <div className="font-semibold" style={{ color: "var(--gx-accent)" }}>{children}</div>;
}

function PositionRange({ start, end }: Pick<PlotTooltip, "start" | "end">) {
  if (start == null || end == null) return null;
  return <div>Position: {start.toLocaleString()} - {end.toLocaleString()}</div>;
}

/** Tooltip content is a view of the renderer payload; positioning stays with the canvas owner. */
export default function PlotTooltipContent({ tooltip }: PlotTooltipContentProps) {
  switch (tooltip.type) {
    case "gap":
      return (
        <>
          <TooltipHeading>{tooltip.queryName}</TooltipHeading>
          <div>Unaligned reference interval</div>
          <div className="break-words">Reference: {tooltip.name}</div>
          {tooltip.contigName && <div className="text-xs break-words">Contig: {tooltip.contigName} (merged reference coordinates)</div>}
          <div>{tooltip.start?.toLocaleString()}–{tooltip.end?.toLocaleString()} ({tooltip.length?.toLocaleString()} bp)</div>
          <div>Pointer: {tooltip.position?.toLocaleString()} bp</div>
          <div className="text-xs">Coordinates: 1-based, inclusive</div>
          <div className="mt-1 text-xs">{tooltip.hasCds ? "Reference CDS overlapping interval:" : "Reference CDS annotations unavailable"}</div>
          {tooltip.hasCds && !tooltip.cds?.length && <div className="text-xs">None</div>}
          {tooltip.cds?.map((cds, index) => (
            <div key={index} className="text-xs break-words mt-1">
              <strong>{cds.name}</strong>{cds.locusTag && cds.locusTag !== cds.name ? ` (${cds.locusTag})` : ""} ({cds.strand})
              {cds.product && cds.product !== cds.name && <div>{cds.product}</div>}
            </div>
          ))}
          {tooltip.moreCds && <div className="text-xs">More CDS overlap this interval</div>}
        </>
      );

    case "gc-content":
      return (
        <>
          <TooltipHeading>GC Content</TooltipHeading>
          <div>Position: {tooltip.position?.toLocaleString()}</div>
          <div>Window: {tooltip.windowSize?.toLocaleString()} bp</div>
          <div>GC: {tooltip.gc}%</div>
        </>
      );

    case "gc-skew":
      return (
        <>
          <TooltipHeading>GC Skew</TooltipHeading>
          <div>Position: {tooltip.position?.toLocaleString()}</div>
          <div>Window: {tooltip.windowSize?.toLocaleString()} bp</div>
          <div>Skew: {tooltip.skew}</div>
        </>
      );

    case "contig":
      return (
        <>
          <TooltipHeading>{tooltip.name}</TooltipHeading>
          <PositionRange start={tooltip.start} end={tooltip.end} />
          {tooltip.length != null && <div>Length: {tooltip.length.toLocaleString()} bp</div>}
        </>
      );

    case "graph":
      return (
        <>
          <TooltipHeading>{tooltip.queryName}</TooltipHeading>
          <PositionRange start={tooltip.start} end={tooltip.end} />
          {tooltip.value != null && <div>Value: {tooltip.value}</div>}
        </>
      );

    case "annotation":
      return (
        <>
          <TooltipHeading>{tooltip.label}</TooltipHeading>
          <PositionRange start={tooltip.start} end={tooltip.end} />
          {tooltip.strand && <div>Strand: {tooltip.strand}</div>}
        </>
      );

    default:
      return (
        <>
          <TooltipHeading>{tooltip.queryName}</TooltipHeading>
          <PositionRange start={tooltip.start} end={tooltip.end} />
          {tooltip.identity != null && <div>Identity: {tooltip.identity.toFixed(1)}%</div>}
          {tooltip.coverage != null && <div>Coverage: {(tooltip.coverage * 100).toFixed(1)}%</div>}
        </>
      );
  }
}
