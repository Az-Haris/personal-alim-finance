import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/stat-card";
import { TxRow } from "@/components/transaction-list";
import { TransactionDialog } from "@/components/transaction-dialog";
import { useFinanceData } from "@/hooks/use-finance";
import { useMonth } from "@/lib/month-context";
import { formatBDT, inMonth, incomeBySource, type Tx } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/income")({
  head: () => ({
    meta: [
      { title: "Income — TakaFlow" },
      { name: "description", content: "Monthly income totals, source breakdown and full income history." },
      { property: "og:title", content: "Income — TakaFlow" },
      { property: "og:description", content: "Monthly income totals and source breakdown." },
    ],
  }),
  component: IncomePage,
});

function IncomePage() {
  const data = useFinanceData();
  const { year, month, label } = useMonth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);

  const monthIncome = useMemo(
    () => data.transactions.filter((t) => t.type === "income" && inMonth(t, year, month)),
    [data.transactions, year, month],
  );
  const total = monthIncome.reduce((s, t) => s + Number(t.amount), 0);
  const bySource = useMemo(
    () => incomeBySource(data.transactions, year, month),
    [data.transactions, year, month],
  );

  const sourceRows = useMemo(
    () =>
      data.incomeSources
        .map((s) => ({ name: s.name, value: bySource.get(s.id) ?? 0 }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value),
    [data.incomeSources, bySource],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Income"
        description={`Money received in ${label}.`}
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Income
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total income" value={total} icon={TrendingUp} tone="income" />
        <StatCard
          label="Entries"
          value={monthIncome.length}
          icon={TrendingUp}
          tone="neutral"
          hint="Income records this month"
        />
      </div>

      <SectionCard title="Income by source" description={label}>
        {sourceRows.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No income recorded"
            description="Add your salary, allowance or freelance income to see the breakdown."
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                Add Income
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3.5">
            {sourceRows.map((r) => (
              <li key={r.name}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{r.name}</span>
                  <span className="tnum text-sm font-bold amount-income">{formatBDT(r.value)}</span>
                </div>
                <Progress
                  value={total > 0 ? (r.value / total) * 100 : 0}
                  className="h-2 [&>div]:bg-income"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {total > 0 ? Math.round((r.value / total) * 100) : 0}% of monthly income
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Income history" description={label}>
        {monthIncome.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Nothing here yet"
            description="Income you record this month will show up here."
          />
        ) : (
          <div className="divide-y divide-border">
            {monthIncome.map((tx) => (
              <TxRow
                key={tx.id}
                tx={tx}
                lookups={data}
                onClick={() => {
                  setEditing(tx);
                  setOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <TransactionDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        defaultType="income"
      />
    </div>
  );
}
