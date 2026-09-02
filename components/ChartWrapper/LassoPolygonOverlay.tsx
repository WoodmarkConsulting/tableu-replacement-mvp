import type { RefObject } from "react";

type LassoPolygonOverlayProps = {
  pathRef: RefObject<SVGPathElement | null>;
};

/** Provides the directly updated freehand contour for an active lasso gesture. */
export default function LassoPolygonOverlay({
  pathRef,
}: LassoPolygonOverlayProps) {
  return (
    <svg className="pointer-events-none absolute inset-0 size-full overflow-visible">
      <path
        ref={pathRef}
        className="hidden fill-primary/10 stroke-primary"
        strokeWidth="1"
      />
    </svg>
  );
}
