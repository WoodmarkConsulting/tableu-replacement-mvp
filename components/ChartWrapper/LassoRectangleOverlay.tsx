import type { RefObject } from "react";

type LassoRectangleOverlayProps = {
  rectangleRef: RefObject<HTMLDivElement | null>;
};

/** Provides the directly updated visual rectangle for an active lasso gesture. */
export default function LassoRectangleOverlay({
  rectangleRef,
}: LassoRectangleOverlayProps) {
  return (
    <div
      ref={rectangleRef}
      className="pointer-events-none absolute hidden border border-primary bg-primary/10"
    />
  );
}
