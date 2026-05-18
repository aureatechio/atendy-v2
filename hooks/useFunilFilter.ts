import { useMemo, useState } from "react";
import { toDateRange } from "@/lib/period";
import type { PeriodPreset } from "@/lib/types";

interface FunilFilterState {
  period: PeriodPreset;
  periodFrom: string;
  periodTo: string;
  scale: "sqrt" | "linear";
}

const defaultState: FunilFilterState = {
  period: "all",
  periodFrom: "",
  periodTo: "",
  scale: "sqrt",
};

export function useFunilFilter() {
  const [state, setState] = useState(defaultState);

  const periodRange = useMemo(() => {
    if (state.period !== "custom") return toDateRange(state.period, { from: "", to: "" });
    return toDateRange("custom", { from: state.periodFrom, to: state.periodTo });
  }, [state.period, state.periodFrom, state.periodTo]);

  const setFilter = <K extends keyof FunilFilterState>(key: K, value: FunilFilterState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  return {
    state,
    setFilter,
    periodRange,
  };
}

export type { FunilFilterState };
