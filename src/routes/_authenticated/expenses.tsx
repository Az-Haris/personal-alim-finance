import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, TrendingDown, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/stat-card";
import { TxRow } from "@/components/transaction-list";
import { TransactionDialog } from "@/components/transaction-dialog";
import { useFinanceData } from "@/hooks/use-finance";
import { useMonth } from "@/lib/month-context";
import { expenseByCategory, formatBDT, inMonth, type Tx } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — TakaFlow" },
      { name: "description", content: "Monthly expense totals with category, subcategory, event and account filters." },
      { property: "og:title", content: "Expenses — TakaFlow" },
      { property: "og:description", content: "Monthly expense totals and category breakdown." },
    ],
  }),
  component: ExpensesPage,
});

const ALL = "all";

function ExpensesPage() {
  const data = useFinanceData();
  const { year, month, label } = useMonth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [categoryId, setCategoryId] = useState(ALL);
  const [subcategoryId, setSubcategoryId] = useState(ALL);
  const [eventId, setEventId] = useState(ALL);
  const [accountId, setAccountId] = useState(ALL);

  const monthExpenses = useMemo(
    () => data.transactions.filter((t) => t.type === "expense" && inMonth(t, year, month)),
    [data.transactions, year, month],
  );
  const total = monthExpenses.reduce((s, t) => s + Number(t.amount), 0);

  const catTotals = useMemo(
    () => expenseByCategory(data.transactions, year, month),
    [data.transactions, year, month],
  );
  const catRows = useMemo(
    () =>
      data.categories
        .map((c) => ({ id: c.id, name: c.name, value: catTotals.get(c.id) ?? 0 }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value),
    [data.categories, catTotals],
  );

  const subsForFilter = useMemo(
    () => data.subcategories.filter((s) => categoryId === ALL || s.category_id === categoryId),
    [data.subcategories, categoryId],
  );

  const filtered = useMemo(
    () =>
      monthExpenses.filter((tx) => {
        if (categoryId !== ALL && tx.category_id !== categoryId) return false;
        if (subcategoryId !== ALL && tx.subcategory_id !== subcategoryId) return false;
        if (eventId !== ALL && tx.event_id !== eventId) return false;
        if (accountId !== ALL && tx.account_id !== accountId) return false;
        return true;
      }),
    [monthExpenses, categoryId, subcategoryId, eventId, accountId],
  );
  const filteredTotal = filtered.reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expenses"
        description={`Where your money went in ${label}.`}
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total expense" value={total} icon={TrendingDown} tone="expense" />
        <StatCard
          label="Top category"
          value={catRows[0]?.value ?? 0}
          icon={Receipt}
          tone="neutral"
          hint={catRows[0]?.name ?? "No spending yet"}
        />
      </div>

      <SectionCard title="Spending by category" description={label}>
        {catRows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No expenses this month"
            description="Start tracking your money by adding your first expense."
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                Add Expense
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3.5">
            {catRows.map((r) => (
              <li key={r.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{r.name}</span>
                  <span className="tnum text-sm font-bold amount-expense">{formatBDT(r.value)}</span>
                </div>
                <Progress
                  value={total > 0 ? (r.value / total) * 100 : 0}
                  className="h-2 [&>div]:bg-expense"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {total > 0 ? Math.round((r.value / total) * 100) : 0}% of monthly spending
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Expense history" description={`Showing ${formatBDT(filteredTotal)} across ${filtered.length} entries`}>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Filter
            label="Category"
            value={categoryId}
            onChange={(v) => {
              setCategoryId(v);
              setSubcategoryId(ALL);
            }}
            allLabel="All categories"
            options={data.categories}
          />
          <Filter
            label="Subcategory"
            value={subcategoryId}
            onChange={setSubcategoryId}
            allLabel="All subcategories"
            options={subsForFilter}
          />
          <Filter
            label="Purpose / Event"
            value={eventId}
            onChange={setEventId}
            allLabel="All events"
            options={data.events}
          />
          <Filter
            label="Account"
            value={accountId}
            onChange={setAccountId}
            allLabel="All accounts"
            options={data.accounts}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No matching expenses"
            description="Try changing the filters above."
          />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((tx) => (
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
        defaultType="expense"
      />
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  allLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
