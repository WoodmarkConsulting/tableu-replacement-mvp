import { create } from "zustand";

export type QueryTiming = {
  chartID: string;
  label?: string;
  durationMs: number;
  timestamp: number;
};

type QueryTimingState = {
  timings: Record<string, QueryTiming>;
  recordTiming: (timing: QueryTiming) => void;
  clearTimings: () => void;
};

const useQueryTimingStore = create<QueryTimingState>((set) => ({
  timings: {},
  recordTiming: (timing) =>
    set((state) => ({
      timings: { ...state.timings, [timing.chartID]: timing },
    })),
  clearTimings: () => set({ timings: {} }),
}));

export default useQueryTimingStore;
