import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBDT, relativeDay, type Tx } from "@/lib/finance";
import type { Account, Category, FinanceEvent, Subcategory } from "@/lib/finance";

export interface TxLookups {
  accounts: Account[];
  categories: Category[];
  subcategories: Subcategory[];
  incomeSources: Category[];
  events: FinanceEvent[];
}

function name(list: { id: string; name: string }[], id: string | null): string | null {
  if (!id) return null;
  return list.find((x) => x.id === id)?.name ?? null;
}

export function describeTx(tx: Tx, l: TxLookups) {
  if (tx.type === "income") {
    return {
      title: name(l.incomeSources, tx.income_source_id) ?? "Income",
      subtitle: [name(l.accounts, tx.account_id)].filter(Boolean).join(" · "),
      tags: [] as string[],
      accountText: name(l.accounts, tx.account_id) ?? "—",
    };
  }
  if (tx.type === "expense") {
    return {
      title: name(l.categories, tx.category_id) ?? "Expense",
      subtitle: name(l.subcategories, tx.subcategory_id) ?? "",
      tags: [name(l.events, tx.event_id)].filter(Boolean) as string[],
      accountText: name(l.accounts, tx.account_id) ?? "—",
    };
  }
  const from = name(l.accounts, tx.from_account_id) ?? "?";
  const to = name(l.accounts, tx.to_account_id) ?? "?";
  return {
    title: "Transfer / Saving",
    subtitle: `${from} → ${to}`,
    tags: [tx.transfer_purpose].filter(Boolean) as string[],
    accountText: `${from} → ${to}`,
  };
}

export function TxRow({
  tx,
  lookups,
  onClick,
}: {
  tx: Tx;
  lookups: TxLookups;
  onClick?: () => void;
}) {
  const d = describeTx(tx, lookups);
  const Icon =
    tx.type === "income" ? ArrowDownLeft : tx.type === "expense" ? ArrowUpRight : ArrowLeftRight;
  const chip =
    tx.type === "income" ? "chip-income" : tx.type === "expense" ? "chip-expense" : "chip-saving";
  const amountClass =
    tx.type === "income" ? "amount-income" : tx.type === "expense" ? "amount-expense" : "amount-saving";
  const prefix = tx.type === "income" ? "+" : tx.type === "expense" ? "-" : "";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-muted/60"
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", chip)}>
        <Icon className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{d.title}</p>
          {d.tags.map((t) => (
            <span
              key={t}
              className="hidden shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[0.68rem] font-medium text-muted-foreground sm:inline"
            >
              {t}
            </span>
          ))}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {[relativeDay(tx.transaction_date), d.subtitle, tx.note].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("tnum text-sm font-bold", amountClass)}>
          {prefix}
          {formatBDT(Number(tx.amount))}
        </p>
        <p className="truncate text-[0.68rem] text-muted-foreground">{d.accountText}</p>
      </div>
    </button>
  );
}
