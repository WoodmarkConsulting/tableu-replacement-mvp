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
  select?: (shape: LassoShape) => D[];
  applyZoom?: (shape: LassoShape) => boolean;
  resetZoom?: () => void;
};

type LassoController<D extends object> = {
  mode: LassoMode | null;
  registerAdapter: (adapter: LassoAdapter<D> | null) => void;
};
