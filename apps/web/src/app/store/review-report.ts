import { create } from "zustand";

interface ReviewReportState {
  kyoku: string;
  deviationLevel: string;
  decisionType: string;
  selectedEntryId: number | null;
  setKyoku: (value: string) => void;
  setDeviationLevel: (value: string) => void;
  setDecisionType: (value: string) => void;
  setSelectedEntryId: (value: number | null) => void;
  reset: () => void;
}

const initialState = {
  kyoku: "all",
  deviationLevel: "all",
  decisionType: "all",
  selectedEntryId: null,
};

export const useReviewReportStore = create<ReviewReportState>((set) => ({
  ...initialState,
  setKyoku: (value) => set({ kyoku: value, selectedEntryId: null }),
  setDeviationLevel: (value) => set({ deviationLevel: value, selectedEntryId: null }),
  setDecisionType: (value) => set({ decisionType: value, selectedEntryId: null }),
  setSelectedEntryId: (value) => set({ selectedEntryId: value }),
  reset: () => set(initialState),
}));
