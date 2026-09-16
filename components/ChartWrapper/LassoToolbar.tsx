import { LassoSelect, RotateCcw, ScanSearch, Undo2 } from "lucide-react";

import { CardAction } from "@/components/ui/card";
import LassoToolbarButton from "./LassoToolbarButton";

type LassoToolbarProps<DataType extends object> = {
  adapter: LassoAdapter<DataType>;
  mode: LassoMode | null;
  hasZoom: boolean;
  disabled: boolean;
  onModeChange: (mode: LassoMode) => void;
  onUndoZoom: () => void;
  onResetZoom: () => void;
};

/** Renders controls for the operations supported by a chart's lasso adapter. */
export default function LassoToolbar<DataType extends object>({
  adapter,
  mode,
  hasZoom,
  disabled,
  onModeChange,
  onUndoZoom,
  onResetZoom,
}: LassoToolbarProps<DataType>) {
  return (
    <CardAction>
      <div className="flex items-center gap-1 print:hidden">
        {adapter.select ? (
          <LassoToolbarButton
            label={
              adapter.selectionDisabled
                ? "Lasso-Auswahl ist nur im interaktiven Modus verfügbar"
                : "Bereich auswählen"
            }
            active={mode === "selection"}
            disabled={disabled || adapter.selectionDisabled}
            onClick={() => onModeChange("selection")}>
            <LassoSelect />
          </LassoToolbarButton>
        ) : null}

        {adapter.applyZoom && adapter.resetZoom ? (
          <LassoToolbarButton
            label="Bereich vergrößern"
            active={mode === "zoom"}
            disabled={disabled}
            onClick={() => onModeChange("zoom")}>
            <ScanSearch />
          </LassoToolbarButton>
        ) : null}

        {hasZoom && adapter.undoZoom ? (
          <LassoToolbarButton
            label="Letzten Ansichtsschritt zurück"
            active={false}
            disabled={disabled}
            onClick={onUndoZoom}>
            <Undo2 />
          </LassoToolbarButton>
        ) : null}

        {hasZoom && adapter.resetZoom ? (
          <LassoToolbarButton
            label="Ansicht zurücksetzen"
            active={false}
            disabled={disabled}
            onClick={onResetZoom}>
            <RotateCcw />
          </LassoToolbarButton>
        ) : null}
      </div>
    </CardAction>
  );
}
