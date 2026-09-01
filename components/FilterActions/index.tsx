"use client";

import { Button } from "@/components/ui/button";
import useFiltersStore, { isDirty } from "@/stores/filterProvider";

// Apply/Reset controls for the deferred-query model. Charts only fetch after the
// draft filter edits are committed via Apply. Hidden in print/export output.
export function FilterActions() {
  const applyFilters = useFiltersStore((state) => state.applyFilters);
  const resetDraft = useFiltersStore((state) => state.resetDraft);
  const hasApplied = useFiltersStore((state) => state.hasApplied);
  const dirty = useFiltersStore(isDirty);

  // Allow the first Apply even with no edits, so charts can run once on open.
  const canApply = dirty || !hasApplied;

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button size="sm" onClick={applyFilters} disabled={!canApply}>
        Anwenden
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onClick={resetDraft}
        disabled={!dirty}>
        Zurücksetzen
      </Button>

      {dirty ? (
        <span className="text-xs text-muted-foreground">
          Nicht angewendete Änderungen
        </span>
      ) : null}
    </div>
  );
}
