import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { BarChart3, CalendarRange, PartyPopper } from "lucide-react";
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/stat-card";
import { useFinanceData } from "@/hooks/use-finance";
import { useMonth } from "@/lib/month-context";
import {
  MONTH_NAMES,
  expenseByEvent,
  formatBDT,
  summarizeMonth,
  type Tx,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — TakaFlow" },
      { name: "description", content: "Twelve-month income vs expense trends, savings rate and per-event spending reports." },
      { property: "og:title", content: "Reports — TakaFlow" },
      { property: "og:description", content: "Income vs expense trends and event spending reports." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const data = useFinanceData();
  const { year, month } = useMonth();

  const months = useMemo(() => {
    const out: { key: string; label: string; income: number; expense: number; net: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const s = summarizeMonth(data.transactions, y, m);
      out.push({
        key: `${y}-${m}`,
        label: `${MONTH_NAMES[m - 1]!.slice(0, 3)} ${String(y).slice(2)}`,
        income: s.income,
        expense: s.expense,
        net: s.income - s.expense,
      });
    }
    return out;
  }, [data.transactions, year, month]);

  const yearTx = useMemo(
    () => data.transactions.filter((t: Tx) => t.transaction_date.startsWith(String(year))),
    [data.transactions, year],
  );
  const yearIncome = yearTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const yearExpense = yearTx.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const savingsRate = yearIncome > 0 ? Math.round(((yearIncome - yearExpense) / yearIncome) * 100) : 0;

  const eventTotals = useMemo(() => expenseByEvent(data.transactions), [data.transactions]);
  const eventRows = useMemo(
    () =>
      data.events
        .map((e) => ({ ...e, total: eventTotals.get(e.id) ?? 0 }))
        .filter((e) => e.total > 0)
        .sort((a, b) => b.total - a.total),
    [data.events, eventTotals],
  );

  const hasData = months.some((m) => m.income > 0 || m.expense > 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" description="Long-term trends across your money." />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={`${year} income`} value={yearIncome} icon={BarChart3} tone="income" />
        <StatCard label={`${year} expense`} value={yearExpense} icon={BarChart3} tone="expense" />
        <StatCard
          label="Savings rate"
          value={`${savingsRate}%`}
          icon={BarChart3}
          tone={savingsRate >= 0 ? "saving" : "expense"}
          hint="Of yearly income kept"
        />
      </div>

      <SectionCard title="Income vs expense" description="Last 12 months">
        {!hasData ? (
          <EmptyState
            icon={BarChart3}
            title="Not enough data yet"
            description="Once you record a few months of transactions, trends appear here."
          />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip
                  formatter={(v: number) => formatBDT(v)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Income" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Net savings trend" description="Income minus expenses each month">
        {!hasData ? (
          <EmptyState
            icon={CalendarRange}
            title="No trend yet"
            description="Your monthly net position will be charted here."
          />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={months} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                  }
                />
                <Tooltip
                  formatter={(v: number) => formatBDT(v)}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-card)",
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  name="Net"
                  stroke="var(--color-saving)"
                  strokeWidth={2.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Spending by event" description="All-time totals per purpose or trip">
        {eventRows.length === 0 ? (
          <EmptyState
            icon={PartyPopper}
            title="No event spending"
            description="Tag expenses with an event (like a tour or wedding) to see totals here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {eventRows.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{e.name}</p>
                  {e.description && (
                    <p className="truncate text-xs text-muted-foreground">{e.description}</p>
                  )}
                </div>
                <span className="tnum shrink-0 text-sm font-bold amount-expense">
                  {formatBDT(e.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
