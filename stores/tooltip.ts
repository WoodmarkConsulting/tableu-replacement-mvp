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
  isStaticTooltip: boolean;

  tooltip: Tooltip | null;
  position: TooltipPosition | null;

  showTooltipOnMove: (args: ShowTooltipArgs) => void;
  showTooltipOnClick: (args: ShowTooltipArgs) => void;

  hideTooltip: () => void;
};

const useTooltipStore = create<TooltipContext>((set, get) => {
  const _getTooltipData = async ({
    chartID,
    dataPoint,
    position,
  }: ShowTooltipArgs) => {
    const newAbortController = new AbortController();

    set(() => ({
      position,
      _abortController: newAbortController,
      tooltip: {
        tooltipData: {} as TooltipPathResponse,
        state: "pending",
      },
    }));

    try {
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

  const debouncedFetch = debounce(async (args: ShowTooltipArgs) => {
    const tooltipData = await _getTooltipData(args);

    if (!tooltipData) {
      return;
    }

    set(() => ({
      tooltip: {
        tooltipData,
        state: "fulfilled",
      },
      isStaticTooltip: false,
    }));
  }, 300);

  //TODO: decide if tooltip should be shown by move or click
  const showTooltipOnMove: TooltipContext["showTooltipOnMove"] = async (
    args,
  ) => {
    get()._abortController.abort();
    debouncedFetch.cancel();

    debouncedFetch(args);
  };

  const showTooltipOnClick: TooltipContext["showTooltipOnClick"] = async (
    args,
  ) => {
    get()._abortController.abort();
    debouncedFetch.cancel();

    const tooltipData = await _getTooltipData(args);

    if (!tooltipData) {
      return;
    }

    set(() => ({
      tooltip: {
        tooltipData,
        state: "fulfilled",
      },
      isStaticTooltip: true,
    }));
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
    isStaticTooltip: true,

    showTooltipOnMove,
    hideTooltip,
    showTooltipOnClick,
  };
});

export default useTooltipStore;
