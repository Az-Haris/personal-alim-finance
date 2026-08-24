export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: "cash" | "mobile_wallet" | "bank" | "other";
  opening_balance: number;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface FinanceEvent {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export type TxType = "income" | "expense" | "transfer";

export interface Tx {
  id: string;
  user_id: string;
  type: TxType;
  amount: number;
  transaction_date: string; // YYYY-MM-DD
  category_id: string | null;
  subcategory_id: string | null;
  income_source_id: string | null;
  event_id: string | null;
  account_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  transfer_purpose: string | null;
  note: string | null;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  month: number;
  year: number;
  category_id: string;
  amount: number;
}

export interface Profile {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const bdtFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const bdtFormatterPrecise = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBDT(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const formatted = Number.isInteger(abs) ? bdtFormatter.format(abs) : bdtFormatterPrecise.format(abs);
  return `${sign}৳${formatted}`;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function inMonth(tx: Tx, year: number, month: number): boolean {
  return tx.transaction_date.startsWith(monthKey(year, month));
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1] ?? ""} ${year}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const name = MONTH_NAMES[(m ?? 1) - 1] ?? "";
  return `${d} ${name.slice(0, 3)} ${y}`;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function relativeDay(iso: string): string {
  const today = todayISO();
  if (iso === today) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yISO = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  if (iso === yISO) return "Yesterday";
  return formatDate(iso);
}

/** Current balance per account: opening + income in + transfers in - expenses - transfers out */
export function computeBalances(accounts: Account[], txs: Tx[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const a of accounts) map.set(a.id, Number(a.opening_balance) || 0);
  for (const tx of txs) {
    const amt = Number(tx.amount);
    if (tx.type === "income" && tx.account_id) {
      map.set(tx.account_id, (map.get(tx.account_id) ?? 0) + amt);
    } else if (tx.type === "expense" && tx.account_id) {
      map.set(tx.account_id, (map.get(tx.account_id) ?? 0) - amt);
    } else if (tx.type === "transfer") {
      if (tx.from_account_id) map.set(tx.from_account_id, (map.get(tx.from_account_id) ?? 0) - amt);
      if (tx.to_account_id) map.set(tx.to_account_id, (map.get(tx.to_account_id) ?? 0) + amt);
    }
  }
  return map;
}

export interface MonthSummary {
  income: number;
  expense: number;
  saved: number; // transfers out of everyday accounts into savings destinations
  remaining: number; // income - expense - saved
}

export function summarizeMonth(txs: Tx[], year: number, month: number): MonthSummary {
  let income = 0;
  let expense = 0;
  let saved = 0;
  for (const tx of txs) {
    if (!inMonth(tx, year, month)) continue;
    const amt = Number(tx.amount);
    if (tx.type === "income") income += amt;
    else if (tx.type === "expense") expense += amt;
    else saved += amt;
  }
  return { income, expense, saved, remaining: income - expense - saved };
}

/** Expense totals grouped by category id for a given month */
export function expenseByCategory(txs: Tx[], year: number, month: number): Map<string, number> {
  const map = new Map<string, number>();
  for (const tx of txs) {
    if (tx.type !== "expense" || !tx.category_id || !inMonth(tx, year, month)) continue;
    map.set(tx.category_id, (map.get(tx.category_id) ?? 0) + Number(tx.amount));
  }
  return map;
}

/** Income totals grouped by income source id for a given month */
export function incomeBySource(txs: Tx[], year: number, month: number): Map<string, number> {
  const map = new Map<string, number>();
  for (const tx of txs) {
    if (tx.type !== "income" || !tx.income_source_id || !inMonth(tx, year, month)) continue;
    map.set(tx.income_source_id, (map.get(tx.income_source_id) ?? 0) + Number(tx.amount));
  }
  return map;
}

/** Expense totals grouped by event id (all time) */
export function expenseByEvent(txs: Tx[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const tx of txs) {
    if (tx.type !== "expense" || !tx.event_id) continue;
    map.set(tx.event_id, (map.get(tx.event_id) ?? 0) + Number(tx.amount));
  }
  return map;
}

export const ACCOUNT_TYPE_LABELS: Record<Account["type"], string> = {
  cash: "Cash",
  mobile_wallet: "Mobile Wallet",
  bank: "Bank",
  other: "Other",
};
