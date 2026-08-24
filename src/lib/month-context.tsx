import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { monthLabel } from "@/lib/finance";

interface MonthContextValue {
  year: number;
  month: number; // 1-12
  label: string;
  isCurrentMonth: boolean;
  setMonth: (year: number, month: number) => void;
  shiftMonth: (delta: number) => void;
  goToCurrentMonth: () => void;
}

const MonthContext = createContext<MonthContextValue | null>(null);

export function MonthProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const [{ year, month }, setState] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });

  const setMonth = useCallback((y: number, m: number) => setState({ year: y, month: m }), []);

  const shiftMonth = useCallback((delta: number) => {
    setState((prev) => {
      const total = prev.year * 12 + (prev.month - 1) + delta;
      return { year: Math.floor(total / 12), month: (total % 12) + 1 };
    });
  }, []);

  const goToCurrentMonth = useCallback(() => {
    const n = new Date();
    setState({ year: n.getFullYear(), month: n.getMonth() + 1 });
  }, []);

  const value = useMemo<MonthContextValue>(() => {
    const n = new Date();
    return {
      year,
      month,
      label: monthLabel(year, month),
      isCurrentMonth: year === n.getFullYear() && month === n.getMonth() + 1,
      setMonth,
      shiftMonth,
      goToCurrentMonth,
    };
  }, [year, month, setMonth, shiftMonth, goToCurrentMonth]);

  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
}

export function useMonth(): MonthContextValue {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth must be used within MonthProvider");
  return ctx;
}
