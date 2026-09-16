type LassoMode = "selection" | "zoom";

type LassoPoint = {
  x: number;
  y: number;
};

type LassoRectangle = {
  kind: "rectangle";
  start: LassoPoint;
  end: LassoPoint;
};

type LassoPolygon = {
  kind: "polygon";
  points: LassoPoint[];
};

type LassoShape = LassoRectangle | LassoPolygon;

type LassoPlotBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LassoAdapter<D extends object> = {
  getPlotBounds: () => LassoPlotBounds | null;
  select?: (shape: LassoShape) => D[] | Promise<D[]>;
  selectionDisabled?: boolean;
  applyZoom?: (shape: LassoShape) => boolean;
  undoZoom?: () => boolean;
  resetZoom?: () => void;
};

type LassoController<D extends object> = {
  mode: LassoMode | null;
  registerAdapter: (adapter: LassoAdapter<D> | null) => void;
  onInteractionLockChange: (locked: boolean) => void;
  onZoomChange: (hasZoom: boolean) => void;
};
