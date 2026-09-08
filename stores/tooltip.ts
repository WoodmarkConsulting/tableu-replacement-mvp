import { create } from "zustand";
import { debounce } from "lodash";
import type {
  TooltipPathRequestBody,
  TooltipPathResponse,
} from "@/app/api/utils/types";
import { fetchTooltipData } from "@/components/ChartWrapper/utils";
import useChartConnectionsStore from "@/stores/chartConnectionsStore";

export type TooltipPosition = {
  x: number;
  y: number;
};

type ShowTooltipArgs = Pick<TooltipPathRequestBody, "chartID"> & {
  dataPoint?: Record<string, unknown | null> | null;
  dataPoints?: TooltipPathRequestBody["dataPoints"];
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

  chartID: string | null;
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
    dataPoints,
    position,
  }: ShowTooltipArgs) => {
    const newAbortController = new AbortController();

    useChartConnectionsStore.getState().clearPendingSourceFilters();

    set(() => ({
      chartID,
      position,
      _abortController: newAbortController,
      tooltip: {
        tooltipData: {} as TooltipPathResponse,
        state: "pending",
      },
    }));

    try {
      return await fetchTooltipData(
        chartID,
        dataPoints ?? [dataPoint ?? {}],
        newAbortController.signal,
      );
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
    useChartConnectionsStore.getState().clearPendingSourceFilters();

    const tooltip = get().tooltip;

    if ((tooltip && !("state" in tooltip)) || !tooltip) {
      return;
    }

    if (tooltip.state === "pending") {
      get()._abortController.abort();
    }

    set({
      chartID: null,
      tooltip: null,
      position: null,
    });
  };

  return {
    _abortController: new AbortController(),
    chartID: null,
    tooltip: null,
    position: null,
    isStaticTooltip: true,

    showTooltipOnMove,
    hideTooltip,
    showTooltipOnClick,
  };
});

export default useTooltipStore;
