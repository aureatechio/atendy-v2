import { useMemo, useState } from "react";
import { toDateRange } from "@/lib/period";
import type { PeriodPreset } from "@/lib/types";

interface FunilFilterState {
  period: PeriodPreset;
  periodFrom: string;
  periodTo: string;
  scale: "sqrt" | "linear";
  monthIndex: number;
}

const defaultState: FunilFilterState = {
  period: "all",
  periodFrom: "",
  periodTo: "",
  scale: "sqrt",
  monthIndex: new Date().getMonth(),
};

export function useFunilFilter() {
  const [state, setState] = useState(defaultState);

  const periodRange = useMemo<[Date | null, Date | null]>(() => {
    if (state.period !== "custom") return toDateRange(state.period, { from: "", to: "" }, { monthIndex: state.monthIndex });
    return toDateRange("custom", { from: state.periodFrom, to: state.periodTo }, { monthIndex: state.monthIndex });
  }, [state.period, state.periodFrom, state.periodTo, state.monthIndex]);

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
