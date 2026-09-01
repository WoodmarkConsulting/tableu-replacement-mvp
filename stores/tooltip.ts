import { create } from "zustand";
import { debounce } from "lodash";
import { apiFetch } from "@/app/api/utils/apiFetch";
import type {
  TooltipPathRequestBody,
  TooltipPathResponse,
} from "@/app/api/utils/types";

export type TooltipPosition = {
  x: number;
  y: number;
};

type ShowTooltipArgs = TooltipPathRequestBody & {
  position: TooltipPosition;
};

export type TooltipLoadingState = "pending" | "fulfilled" | "rejected";
export type Tooltip = {
  tooltipData: TooltipPathResponse;
  state: TooltipLoadingState;
};

type TooltipContext = {
  _abortController: AbortController;

  tooltip: Tooltip | null;
  position: TooltipPosition | null;

  showTooltip: (args: ShowTooltipArgs) => void;

  hideTooltip: () => void;
};

const useTooltipStore = create<TooltipContext>((set, get) => {
  const _getTooltipData = async ({
    chartID,
    dataPoint,
  }: TooltipPathRequestBody) => {
    const newAbortController = new AbortController();

    try {
      set({
        _abortController: newAbortController,
      });

      return await apiFetch("/api/data/chart/tooltip", {
        method: "POST",
        body: {
          chartID,
          dataPoint,
        },
        signal: newAbortController.signal,
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error("Error fetching tooltip data:", error);
      }

      set(() => ({
        tooltip: {
          tooltipData: {} as TooltipPathResponse,
          state: "rejected",
        },
      }));

      return null;
    }
  };

  const debouncedFetch = debounce(
    async ({ chartID, dataPoint, position }: ShowTooltipArgs) => {
      set(() => ({
        position,
        tooltip: {
          tooltipData: {} as TooltipPathResponse,
          state: "pending",
        },
      }));

      const tooltipData = await _getTooltipData({
        chartID,
        dataPoint,
      });

      if (!tooltipData) {
        return;
      }

      set(() => ({
        tooltip: {
          tooltipData,
          state: "fulfilled",
        },
      }));
    },
    300,
  );

  const showTooltip: TooltipContext["showTooltip"] = (args) => {
    get()._abortController.abort();
    debouncedFetch.cancel();

    debouncedFetch(args);
  };

  const hideTooltip: TooltipContext["hideTooltip"] = () => {
    // Avoid loading stale tooltip data
    debouncedFetch.cancel();

    const tooltip = get().tooltip;

    if ((tooltip && !("state" in tooltip)) || !tooltip) {
      return;
    }

    if (tooltip.state === "pending") {
      get()._abortController.abort();
    }

    set({
      tooltip: null,
      position: null,
    });
  };

  return {
    _abortController: new AbortController(),
    tooltip: null,
    position: null,

    showTooltip,
    hideTooltip,
  };
});

export default useTooltipStore;
