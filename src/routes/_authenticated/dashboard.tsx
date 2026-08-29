import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Wallet,
  Plus,
  ArrowRight,
  Receipt,
  Target,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { BudgetBar } from "@/components/budget-bar";
import { StatCard, EmptyState, SectionCard, PageHeader } from "@/components/stat-card";
import { TxRow } from "@/components/transaction-list";
import { TransactionDialog } from "@/components/transaction-dialog";
import { useFinanceData } from "@/hooks/use-finance";
import { useMonth } from "@/lib/month-context";
import {
  computeBalances,
  expenseByCategory,
  formatBDT,
  inMonth,
  summarizeMonth,
  type Tx,
  type TxType,
} from "@/lib/finance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — TakaFlow" },
      { name: "description", content: "Your monthly income, expenses, savings and account balances at a glance." },
      { property: "og:title", content: "Dashboard — TakaFlow" },
      { property: "og:description", content: "Monthly income, expenses, savings and balances at a glance." },
    ],
  }),
  component: Dashboard,
});

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
];

function Dashboard() {
  const { year, month, label } = useMonth();
  const data = useFinanceData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<TxType>("expense");
  const [editing, setEditing] = useState<Tx | null>(null);

  const summary = useMemo(
    () => summarizeMonth(data.transactions, year, month),
    [data.transactions, year, month],
  );
  const balances = useMemo(
    () => computeBalances(data.accounts, data.transactions),
    [data.accounts, data.transactions],
  );
  const catSpend = useMemo(
    () => expenseByCategory(data.transactions, year, month),
    [data.transactions, year, month],
  );

  const chartData = useMemo(
    () =>
      data.categories
        .map((c) => ({ name: c.name, value: catSpend.get(c.id) ?? 0 }))
        .filter((d) => d.value > 0)
        .sort((a, b) => b.value - a.value),
    [data.categories, catSpend],
  );

  const monthBudgets = useMemo(
    () => data.budgets.filter((b) => b.year === year && b.month === month),
    [data.budgets, year, month],
  );
  const totalBudget = monthBudgets.reduce((s, b) => s + Number(b.amount), 0);
  const budgetSpent = monthBudgets.reduce((s, b) => s + (catSpend.get(b.category_id) ?? 0), 0);

  const monthTxs = useMemo(
    () => data.transactions.filter((t) => inMonth(t, year, month)),
    [data.transactions, year, month],
  );
  const recent = data.transactions.slice(0, 8);

  const totalAvailable = data.accounts
    .filter((a) => a.is_active)
    .reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);

  function openAdd(type: TxType) {
    setEditing(null);
    setDialogType(type);
    setDialogOpen(true);
  }

  if (data.isLoading) return <LoadingGrid />;

  return (
    <div className="space-y-5">
      <PageHeader
        title={label}
        description="Money in → money out → money saved → money available."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Income" value={summary.income} icon={TrendingUp} tone="income" />
        <StatCard label="Total Expense" value={summary.expense} icon={TrendingDown} tone="expense" />
        <StatCard
          label="Total Saved"
          value={summary.saved}
          icon={PiggyBank}
          tone="saving"
          hint="Transfers into savings"
        />
        <StatCard
          label="Remaining"
          value={summary.remaining}
          icon={Wallet}
          hint="Income − expense − saved"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Button variant="outline" className="h-12 justify-start gap-2" onClick={() => openAdd("income")}>
          <span className="chip-income flex h-7 w-7 items-center justify-center rounded-lg">
            <TrendingUp className="h-3.5 w-3.5" />
          </span>
          Add Income
        </Button>
        <Button variant="outline" className="h-12 justify-start gap-2" onClick={() => openAdd("expense")}>
          <span className="chip-expense flex h-7 w-7 items-center justify-center rounded-lg">
            <TrendingDown className="h-3.5 w-3.5" />
          </span>
          Add Expense
        </Button>
        <Button variant="outline" className="h-12 justify-start gap-2" onClick={() => openAdd("transfer")}>
          <span className="chip-saving flex h-7 w-7 items-center justify-center rounded-lg">
            <PiggyBank className="h-3.5 w-3.5" />
          </span>
          Transfer / Save
        </Button>
      </div>

      <SectionCard
        title="My Money"
        description={`Total available ${formatBDT(totalAvailable)}`}
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/accounts">
              Manage <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {data.accounts
            .filter((a) => a.is_active)
            .map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
              >
                <span className="text-sm font-medium">{a.name}</span>
                <span
                  className={cn(
                    "tnum text-sm font-bold",
                    (balances.get(a.id) ?? 0) < 0 && "amount-expense",
                  )}
                >
                  {formatBDT(balances.get(a.id) ?? 0)}
                </span>
              </div>
            ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Where the money went" description={`Spending by category · ${label}`}>
          {chartData.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No spending yet"
              description="Add an expense to see your category breakdown."
              action={<Button onClick={() => openAdd("expense")}>Add Expense</Button>}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => formatBDT(v)}
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: "0.5rem",
                        fontSize: "0.8rem",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full flex-1 space-y-1.5">
                {chartData.slice(0, 7).map((d, i) => (
                  <li key={d.name} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    <span className="flex-1 truncate text-muted-foreground">{d.name}</span>
                    <span className="tnum font-semibold">{formatBDT(d.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={`${label.split(" ")[0]} Budget`}
          description={
            totalBudget > 0
              ? `Budget ${formatBDT(totalBudget)} · Spent ${formatBDT(budgetSpent)} · Remaining ${formatBDT(totalBudget - budgetSpent)}`
              : undefined
          }
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/budget">
                Edit <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          }
        >
          {monthBudgets.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No budget created for this month"
              description="Set category limits to keep your spending on track."
              action={
                <Button asChild>
                  <Link to="/budget">Create Monthly Budget</Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3.5">
              {monthBudgets
                .map((b) => ({
                  ...b,
                  name: data.categories.find((c) => c.id === b.category_id)?.name ?? "Category",
                  spent: catSpend.get(b.category_id) ?? 0,
                }))
                .sort((a, b) => b.spent / (Number(b.amount) || 1) - a.spent / (Number(a.amount) || 1))
                .slice(0, 6)
                .map((b) => (
                  <BudgetBar key={b.id} name={b.name} budget={Number(b.amount)} spent={b.spent} />
                ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Recent transactions"
        action={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/transactions">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      >
        {recent.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No transactions yet"
            description="Start tracking your money by adding your first transaction."
            action={
              <Button onClick={() => openAdd("expense")}>
                <Plus className="h-4 w-4" />
                Add Transaction
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {recent.map((tx) => (
              <TxRow
                key={tx.id}
                tx={tx}
                lookups={data}
                onClick={() => {
                  setEditing(tx);
                  setDialogOpen(true);
                }}
              />
            ))}
          </div>
        )}
        {monthTxs.length > 0 && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {monthTxs.length} transaction{monthTxs.length === 1 ? "" : "s"} in {label}
          </p>
        )}
      </SectionCard>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        defaultType={dialogType}
      />
    </div>
  );
}


function LoadingGrid() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}
