import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, SlidersHorizontal, Receipt, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EmptyState, PageHeader, SectionCard } from "@/components/stat-card";
import { TxRow, describeTx } from "@/components/transaction-list";
import { TransactionDialog } from "@/components/transaction-dialog";
import { useFinanceData } from "@/hooks/use-finance";
import { useMonth } from "@/lib/month-context";
import { formatBDT, inMonth, relativeDay, type Tx, type TxType } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — TakaFlow" },
      { name: "description", content: "Full history of your income, expenses and transfers with search and filters." },
      { property: "og:title", content: "Transactions — TakaFlow" },
      { property: "og:description", content: "Full history of your income, expenses and transfers." },
    ],
  }),
  component: TransactionsPage,
});

const ALL = "all";

function TransactionsPage() {
  const data = useFinanceData();
  const { year, month, label } = useMonth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Tx | null>(null);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"month" | "all" | "range">("month");
  const [type, setType] = useState<TxType | typeof ALL>(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [accountId, setAccountId] = useState(ALL);
  const [eventId, setEventId] = useState(ALL);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.transactions.filter((tx) => {
      if (scope === "month" && !inMonth(tx, year, month)) return false;
      if (scope === "range") {
        if (fromDate && tx.transaction_date < fromDate) return false;
        if (toDate && tx.transaction_date > toDate) return false;
      }
      if (type !== ALL && tx.type !== type) return false;
      if (categoryId !== ALL && tx.category_id !== categoryId) return false;
      if (eventId !== ALL && tx.event_id !== eventId) return false;
      if (accountId !== ALL) {
        const touches =
          tx.account_id === accountId ||
          tx.from_account_id === accountId ||
          tx.to_account_id === accountId;
        if (!touches) return false;
      }
      if (q) {
        const d = describeTx(tx, data);
        const haystack = [d.title, d.subtitle, d.accountText, tx.note, ...d.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, scope, type, categoryId, accountId, eventId, fromDate, toDate, year, month]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let transfer = 0;
    for (const tx of filtered) {
      const amt = Number(tx.amount);
      if (tx.type === "income") income += amt;
      else if (tx.type === "expense") expense += amt;
      else transfer += amt;
    }
    return { income, expense, transfer };
  }, [filtered]);

  const activeFilters =
    (type !== ALL ? 1 : 0) +
    (categoryId !== ALL ? 1 : 0) +
    (accountId !== ALL ? 1 : 0) +
    (eventId !== ALL ? 1 : 0) +
    (scope !== "month" ? 1 : 0);

  function resetFilters() {
    setType(ALL);
    setCategoryId(ALL);
    setAccountId(ALL);
    setEventId(ALL);
    setScope("month");
    setFromDate("");
    setToDate("");
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Tx[]>();
    for (const tx of filtered) {
      const list = map.get(tx.transaction_date) ?? [];
      list.push(tx);
      map.set(tx.transaction_date, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const filterControls = (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Period</Label>
        <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">{label}</SelectItem>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="range">Custom range</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {scope === "range" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>
      )}
      <FilterSelect
        label="Type"
        value={type}
        onChange={(v) => setType(v as TxType | typeof ALL)}
        allLabel="All types"
        options={[
          { id: "income", name: "Income" },
          { id: "expense", name: "Expense" },
          { id: "transfer", name: "Transfer" },
        ]}
      />
      <FilterSelect
        label="Category"
        value={categoryId}
        onChange={setCategoryId}
        allLabel="All categories"
        options={data.categories}
      />
      <FilterSelect
        label="Account"
        value={accountId}
        onChange={setAccountId}
        allLabel="All accounts"
        options={data.accounts}
      />
      <FilterSelect
        label="Purpose / Event"
        value={eventId}
        onChange={setEventId}
        allLabel="All events"
        options={data.events}
      />
      {activeFilters > 0 && (
        <Button variant="outline" className="w-full" onClick={resetFilters}>
          <X className="h-4 w-4" />
          Clear filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transactions"
        description="Every taka in, out and moved between your accounts."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        }
      />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search category, event, note, account…"
            className="pl-9"
            maxLength={100}
          />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="shrink-0 lg:hidden">
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilters > 0 && <Badge className="ml-1 h-5 px-1.5">{activeFilters}</Badge>}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">{filterControls}</div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <aside className="hidden lg:block">
          <SectionCard title="Filters">{filterControls}</SectionCard>
        </aside>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <MiniTotal label="Income" value={totals.income} cls="amount-income" />
            <MiniTotal label="Expense" value={totals.expense} cls="amount-expense" />
            <MiniTotal label="Transfers" value={totals.transfer} cls="amount-saving" />
          </div>

          <SectionCard>
            {filtered.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No transactions found"
                description={
                  activeFilters > 0 || search
                    ? "Try adjusting your filters or search."
                    : "Start tracking your money by adding your first transaction."
                }
                action={
                  <Button
                    onClick={() => {
                      setEditing(null);
                      setDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add Transaction
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                {grouped.map(([date, txs]) => (
                  <div key={date}>
                    <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {txs[0] ? describeDate(date) : date}
                    </p>
                    <div className="divide-y divide-border">
                      {txs.map((tx) => (
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
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
      />
    </div>
  );
}


function MiniTotal({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="surface-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`tnum text-sm font-bold ${cls}`}>{formatBDT(value)}</p>
    </div>
  );
}

function FilterSelect({
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
