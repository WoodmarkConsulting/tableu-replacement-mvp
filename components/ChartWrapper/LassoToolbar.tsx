import { LassoSelect, RotateCcw, ScanSearch } from "lucide-react";

import { CardAction } from "@/components/ui/card";
import LassoToolbarButton from "./LassoToolbarButton";

type LassoToolbarProps<DataType extends object> = {
  adapter: LassoAdapter<DataType>;
  mode: LassoMode | null;
  hasZoom: boolean;
  onModeChange: (mode: LassoMode) => void;
  onResetZoom: () => void;
};

/** Renders controls for the operations supported by a chart's lasso adapter. */
export default function LassoToolbar<DataType extends object>({
  adapter,
  mode,
  hasZoom,
  onModeChange,
  onResetZoom,
}: LassoToolbarProps<DataType>) {
  return (
    <CardAction>
      <div className="flex items-center gap-1 print:hidden">
        {adapter.select ? (
          <LassoToolbarButton
            label="Bereich auswählen"
            active={mode === "selection"}
            onClick={() => onModeChange("selection")}>
            <LassoSelect />
          </LassoToolbarButton>
        ) : null}

        {adapter.applyZoom && adapter.resetZoom ? (
          <LassoToolbarButton
            label="Bereich vergrößern"
            active={mode === "zoom"}
            onClick={() => onModeChange("zoom")}>
            <ScanSearch />
          </LassoToolbarButton>
        ) : null}

        {hasZoom && adapter.resetZoom ? (
          <LassoToolbarButton
            label="Zoom zurücksetzen"
            active={false}
            onClick={onResetZoom}>
            <RotateCcw />
          </LassoToolbarButton>
        ) : null}
      </div>
    </CardAction>
  );
}
