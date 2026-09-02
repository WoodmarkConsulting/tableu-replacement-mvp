import { useRef, type RefObject } from "react";

import LassoPolygonOverlay from "./LassoPolygonOverlay";
import LassoRectangleOverlay from "./LassoRectangleOverlay";
import {
  clampPointToBounds,
  createNormalizedPolygon,
  createNormalizedRectangle,
  getSurfacePoint,
  isPointInBounds,
} from "./utils";

const MIN_LASSO_DISTANCE = 5;
const MIN_POINT_DISTANCE = 2;

type LassoInteractionOverlayProps<DataType extends object> = {
  mode: LassoMode | null;
  adapter: LassoAdapter<DataType> | null;
  surfaceRef: RefObject<HTMLDivElement | null>;
  onSelectionChange: (rows: DataType[]) => void;
  onZoomApplied: () => void;
};

/**
 * Captures lasso pointer gestures without updating React state while dragging.
 * Only a completed selection or zoom is reported to the chart wrapper.
 */
export default function LassoInteractionOverlay<DataType extends object>({
  mode,
  adapter,
  surfaceRef,
  onSelectionChange,
  onZoomApplied,
}: LassoInteractionOverlayProps<DataType>) {
  const startRef = useRef<LassoPoint | null>(null);
  const pointsRef = useRef<LassoPoint[]>([]);
  const plotBoundsRef = useRef<LassoPlotBounds | null>(null);
  const polygonPathRef = useRef<SVGPathElement>(null);
  const rectangleRef = useRef<HTMLDivElement>(null);

  if (mode === null) {
    return null;
  }

  const clearGesture = () => {
    startRef.current = null;
    pointsRef.current = [];
    plotBoundsRef.current = null;

    if (polygonPathRef.current) {
      polygonPathRef.current.style.display = "none";
      polygonPathRef.current.removeAttribute("d");
    }

    if (rectangleRef.current) {
      rectangleRef.current.style.display = "none";
    }
  };

  const appendPolygonPoint = (point: LassoPoint) => {
    const points = pointsRef.current;
    const previousPoint = points.at(-1);

    if (
      previousPoint &&
      Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) <
        MIN_POINT_DISTANCE
    ) {
      return;
    }

    points.push(point);

    if (!polygonPathRef.current || points.length < 2) {
      return;
    }

    const [firstPoint, ...remainingPoints] = points;
    const path = remainingPoints.reduce(
      (value, currentPoint) => `${value} L ${currentPoint.x} ${currentPoint.y}`,
      `M ${firstPoint.x} ${firstPoint.y}`,
    );

    polygonPathRef.current.style.display = "block";
    polygonPathRef.current.setAttribute("d", `${path} Z`);
  };

  const updateRectangle = (start: LassoPoint, end: LassoPoint) => {
    const rectangle = rectangleRef.current;

    if (!rectangle) {
      return;
    }

    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);

    rectangle.style.display = "block";
    rectangle.style.transform = `translate(${left}px, ${top}px)`;
    rectangle.style.width = `${Math.abs(end.x - start.x)}px`;
    rectangle.style.height = `${Math.abs(end.y - start.y)}px`;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const plotBounds = adapter?.getPlotBounds();
    const surface = surfaceRef.current;

    if (
      !plotBounds ||
      !surface ||
      plotBounds.width <= 0 ||
      plotBounds.height <= 0
    ) {
      return;
    }

    const point = getSurfacePoint(event, surface);

    if (!isPointInBounds(point, plotBounds)) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    startRef.current = point;
    plotBoundsRef.current = plotBounds;

    if (mode === "selection") {
      pointsRef.current = [point];
    } else {
      updateRectangle(point, point);
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    const surface = surfaceRef.current;

    if (!surface) {
      return;
    }

    const surfacePoint = getSurfacePoint(event, surface);
    const plotBounds = plotBoundsRef.current ?? adapter?.getPlotBounds();

    if (!plotBounds) {
      return;
    }

    if (!start) {
      return;
    }

    const current = clampPointToBounds(surfacePoint, plotBounds);

    if (mode === "selection") {
      appendPolygonPoint(current);
    } else {
      updateRectangle(start, current);
    }
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const start = startRef.current;
    const plotBounds = plotBoundsRef.current;
    const surface = surfaceRef.current;

    if (!start || !plotBounds || !surface || !adapter) {
      clearGesture();
      return;
    }

    const end = clampPointToBounds(getSurfacePoint(event, surface), plotBounds);
    let points: LassoPoint[] = [];
    let distance = Math.hypot(end.x - start.x, end.y - start.y);

    if (mode === "selection") {
      appendPolygonPoint(end);
      points = [...pointsRef.current];
      distance = points.reduce(
        (maximum, point) =>
          Math.max(maximum, Math.hypot(point.x - start.x, point.y - start.y)),
        0,
      );
    }

    clearGesture();

    if (distance < MIN_LASSO_DISTANCE) {
      return;
    }

    if (mode === "selection") {
      if (points.length < 3) {
        return;
      }

      const shape = createNormalizedPolygon(points, plotBounds);
      const selectedRows = adapter.select?.(shape) ?? [];

      if (selectedRows.length > 0) {
        onSelectionChange(selectedRows);
      }
    } else {
      const shape = createNormalizedRectangle(start, end, plotBounds);

      if (adapter.applyZoom?.(shape)) {
        onZoomApplied();
      }
    }
  };

  return (
    <div
      className="absolute inset-0 z-20 touch-none cursor-pointer"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}>
      <LassoPolygonOverlay pathRef={polygonPathRef} />
      <LassoRectangleOverlay rectangleRef={rectangleRef} />
    </div>
  );
}
