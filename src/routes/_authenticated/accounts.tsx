import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, PiggyBank, Wallet, Pencil, Archive, ArchiveRestore, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/stat-card";
import { TxRow } from "@/components/transaction-list";
import { TransactionDialog } from "@/components/transaction-dialog";
import { useFinanceData, useInvalidateFinance } from "@/hooks/use-finance";
import { useMonth } from "@/lib/month-context";
import {
  ACCOUNT_TYPE_LABELS,
  computeBalances,
  formatBDT,
  inMonth,
  type Account,
  type Tx,
} from "@/lib/finance";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({
    meta: [
      { title: "Savings & Accounts — TakaFlow" },
      { name: "description", content: "Current balance in cash, bKash, bank and your wife's account, plus savings transfers." },
      { property: "og:title", content: "Savings & Accounts — TakaFlow" },
      { property: "og:description", content: "Current balances across all your money accounts." },
    ],
  }),
  component: AccountsPage,
});

function AccountsPage() {
  const data = useFinanceData();
  const invalidate = useInvalidateFinance();
  const { year, month, label } = useMonth();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Tx | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  const balances = useMemo(
    () => computeBalances(data.accounts, data.transactions),
    [data.accounts, data.transactions],
  );

  const active = data.accounts.filter((a) => a.is_active);
  const archived = data.accounts.filter((a) => !a.is_active);
  const totalMoney = active.reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);

  const monthTransfers = useMemo(
    () => data.transactions.filter((t) => t.type === "transfer" && inMonth(t, year, month)),
    [data.transactions, year, month],
  );
  const savedThisMonth = monthTransfers.reduce((s, t) => s + Number(t.amount), 0);

  const accountHistory = useMemo(() => {
    if (!selectedAccount) return [];
    return data.transactions.filter(
      (t) =>
        t.account_id === selectedAccount ||
        t.from_account_id === selectedAccount ||
        t.to_account_id === selectedAccount,
    );
  }, [data.transactions, selectedAccount]);

  async function toggleArchive(account: Account) {
    const { error } = await supabase
      .from("accounts")
      .update({ is_active: !account.is_active })
      .eq("id", account.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(account.is_active ? "Account archived" : "Account restored");
    invalidate(["accounts"]);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Savings & Accounts"
        description="Every taka you hold, calculated automatically from your transactions."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditingTx(null);
                setTxDialogOpen(true);
              }}
            >
              <ArrowLeftRight className="h-4 w-4" />
              Transfer
            </Button>
            <Button
              onClick={() => {
                setEditingAccount(null);
                setEditorOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Account
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total money" value={totalMoney} icon={Wallet} hint="Across active accounts" />
        <StatCard
          label="Saved this month"
          value={savedThisMonth}
          icon={PiggyBank}
          tone="saving"
          hint={`Transfers in ${label}`}
        />
      </div>

      <SectionCard title="My accounts">
        {active.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No accounts yet"
            description="Add an account to start tracking where your money lives."
            action={<Button onClick={() => setEditorOpen(true)}>Add account</Button>}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map((a) => {
              const bal = balances.get(a.id) ?? 0;
              return (
                <div key={a.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[a.type]}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Edit ${a.name}`}
                        onClick={() => {
                          setEditingAccount(a);
                          setEditorOpen(true);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Archive ${a.name}`}
                        onClick={() => toggleArchive(a)}
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className={cn("tnum mt-3 text-xl font-extrabold", bal < 0 && "amount-expense")}>
                    {formatBDT(bal)}
                  </p>
                  <button
                    onClick={() => setSelectedAccount(selectedAccount === a.id ? null : a.id)}
                    className="mt-2 text-xs font-medium text-primary hover:underline"
                  >
                    {selectedAccount === a.id ? "Hide history" : "View history"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {archived.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Archived
            </p>
            <div className="space-y-2">
              {archived.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="tnum text-xs text-muted-foreground">
                      {formatBDT(balances.get(a.id) ?? 0)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => toggleArchive(a)}>
                    <ArchiveRestore className="h-3.5 w-3.5" />
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {selectedAccount && (
        <SectionCard
          title={`${data.accounts.find((a) => a.id === selectedAccount)?.name} history`}
          description="All transactions that touched this account"
          action={
            <Button variant="ghost" size="sm" onClick={() => setSelectedAccount(null)}>
              Close
            </Button>
          }
        >
          {accountHistory.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No activity"
              description="This account has no transactions yet."
            />
          ) : (
            <div className="divide-y divide-border">
              {accountHistory.slice(0, 40).map((tx) => (
                <TxRow
                  key={tx.id}
                  tx={tx}
                  lookups={data}
                  onClick={() => {
                    setEditingTx(tx);
                    setTxDialogOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard title="Savings & transfers" description={label}>
        {monthTransfers.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            title="No savings this month"
            description="Move money into your bKash, bank or wife's account to build savings. Transfers never count as expenses."
            action={
              <Button
                onClick={() => {
                  setEditingTx(null);
                  setTxDialogOpen(true);
                }}
              >
                Transfer / Save
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-border">
            {monthTransfers.map((tx) => (
              <TxRow
                key={tx.id}
                tx={tx}
                lookups={data}
                onClick={() => {
                  setEditingTx(tx);
                  setTxDialogOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <AccountEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        account={editingAccount}
        onSaved={() => invalidate(["accounts"])}
      />
      <TransactionDialog
        open={txDialogOpen}
        onOpenChange={(o) => {
          setTxDialogOpen(o);
          if (!o) setEditingTx(null);
        }}
        editing={editingTx}
        defaultType="transfer"
      />
    </div>
  );
}

function AccountEditor({
  open,
  onOpenChange,
  account,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  account: Account | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Account["type"]>("cash");
  const [opening, setOpening] = useState("0");
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (!open) return;
    setName(account?.name ?? "");
    setType(account?.type ?? "cash");
    setOpening(String(Number(account?.opening_balance ?? 0)));
  }, [open, account]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Account name cannot be empty");
      return;
    }
    const openingNum = Number(opening);
    if (!Number.isFinite(openingNum) || openingNum < 0) {
      toast.error("Opening balance cannot be negative");
      return;
    }
    setSaving(true);
    try {
      if (account) {
        const { error } = await supabase
          .from("accounts")
          .update({ name: trimmed, type, opening_balance: openingNum })
          .eq("id", account.id);
        if (error) throw error;
        toast.success("Account updated successfully");
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await supabase.from("accounts").insert({
          user_id: userData.user!.id,
          name: trimmed,
          type,
          opening_balance: openingNum,
        });
        if (error) throw error;
        toast.success("Account added successfully");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? "Edit account" : "Add account"}</DialogTitle>
          <DialogDescription>
            Balances are calculated from your transactions plus the opening balance.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="acc-name">Name</Label>
            <Input
              id="acc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My bKash"
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as Account["type"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acc-open">Opening balance (৳)</Label>
            <Input
              id="acc-open"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              className="tnum"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
