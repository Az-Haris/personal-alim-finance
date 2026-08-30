import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { todayISO, type Tx, type TxType } from "@/lib/finance";
import { useFinanceData, useInvalidateFinance } from "@/hooks/use-finance";

const NONE = "__none__";
const RECENT_KEY = "takaflow:recent-expense";

const schema = z
  .object({
    type: z.enum(["income", "expense", "transfer"]),
    amount: z.number().positive("Amount must be greater than 0"),
    transaction_date: z.string().min(1, "Date is required"),
    note: z.string().max(500).optional().nullable(),
    account_id: z.string().nullable(),
    income_source_id: z.string().nullable(),
    category_id: z.string().nullable(),
    subcategory_id: z.string().nullable(),
    event_id: z.string().nullable(),
    from_account_id: z.string().nullable(),
    to_account_id: z.string().nullable(),
    transfer_purpose: z.string().max(200).nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "income") {
      if (!v.income_source_id) ctx.addIssue({ code: "custom", message: "Choose an income source", path: ["income_source_id"] });
      if (!v.account_id) ctx.addIssue({ code: "custom", message: "Choose the receiving account", path: ["account_id"] });
    }
    if (v.type === "expense") {
      if (!v.category_id) ctx.addIssue({ code: "custom", message: "Choose a category", path: ["category_id"] });
      if (!v.account_id) ctx.addIssue({ code: "custom", message: "Choose the paying account", path: ["account_id"] });
    }
    if (v.type === "transfer") {
      if (!v.from_account_id) ctx.addIssue({ code: "custom", message: "Choose the From account", path: ["from_account_id"] });
      if (!v.to_account_id) ctx.addIssue({ code: "custom", message: "Choose the To account", path: ["to_account_id"] });
      if (v.from_account_id && v.from_account_id === v.to_account_id) {
        ctx.addIssue({ code: "custom", message: "From and To accounts must be different", path: ["to_account_id"] });
      }
    }
  });

interface FormState {
  type: TxType;
  amount: string;
  transaction_date: string;
  note: string;
  account_id: string;
  income_source_id: string;
  category_id: string;
  subcategory_id: string;
  event_id: string;
  from_account_id: string;
  to_account_id: string;
  transfer_purpose: string;
}

function emptyForm(type: TxType): FormState {
  return {
    type,
    amount: "",
    transaction_date: todayISO(),
    note: "",
    account_id: "",
    income_source_id: "",
    category_id: "",
    subcategory_id: "",
    event_id: "",
    from_account_id: "",
    to_account_id: "",
    transfer_purpose: "",
  };
}

function fromTx(tx: Tx): FormState {
  return {
    type: tx.type,
    amount: String(Number(tx.amount)),
    transaction_date: tx.transaction_date,
    note: tx.note ?? "",
    account_id: tx.account_id ?? "",
    income_source_id: tx.income_source_id ?? "",
    category_id: tx.category_id ?? "",
    subcategory_id: tx.subcategory_id ?? "",
    event_id: tx.event_id ?? "",
    from_account_id: tx.from_account_id ?? "",
    to_account_id: tx.to_account_id ?? "",
    transfer_purpose: tx.transfer_purpose ?? "",
  };
}

export function TransactionDialog({
  open,
  onOpenChange,
  editing,
  defaultType = "expense",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Tx | null;
  defaultType?: TxType;
}) {
  const { accounts, categories, subcategories, incomeSources, events } = useFinanceData();
  const invalidate = useInvalidateFinance();
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultType));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.is_active), [accounts]);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (editing) {
      setForm(fromTx(editing));
      return;
    }
    const base = emptyForm(defaultType);
    if (defaultType === "expense" && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(RECENT_KEY);
        if (raw) {
          const recent = JSON.parse(raw) as Partial<FormState>;
          if (recent.category_id && categories.some((c) => c.id === recent.category_id))
            base.category_id = recent.category_id;
          if (recent.subcategory_id && subcategories.some((s) => s.id === recent.subcategory_id))
            base.subcategory_id = recent.subcategory_id;
          if (recent.account_id && accounts.some((a) => a.id === recent.account_id))
            base.account_id = recent.account_id;
        }
      } catch {
        /* ignore */
      }
    }
    setForm(base);
  }, [open, editing, defaultType, categories, subcategories, accounts]);

  const subsForCategory = useMemo(
    () => subcategories.filter((s) => s.category_id === form.category_id),
    [subcategories, form.category_id],
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "category_id") next.subcategory_id = "";
      return next;
    });
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  function changeType(type: TxType) {
    setForm((f) => ({ ...emptyForm(type), amount: f.amount, transaction_date: f.transaction_date }));
    setErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    const parsed = schema.safeParse({
      type: form.type,
      amount: Number(form.amount),
      transaction_date: form.transaction_date,
      note: form.note.trim() || null,
      account_id: form.account_id || null,
      income_source_id: form.income_source_id || null,
      category_id: form.category_id || null,
      subcategory_id: form.subcategory_id || null,
      event_id: form.event_id || null,
      from_account_id: form.from_account_id || null,
      to_account_id: form.to_account_id || null,
      transfer_purpose: form.transfer_purpose.trim() || null,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("You are signed out. Please sign in again.");

      const payload = { ...parsed.data, note: parsed.data.note ?? null, user_id: userId };

      if (editing) {
        const { error } = await supabase.from("transactions").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Transaction updated successfully");
      } else {
        const { error } = await supabase.from("transactions").insert(payload);
        if (error) throw error;
        toast.success(
          form.type === "income"
            ? "Income added successfully"
            : form.type === "expense"
              ? "Expense added successfully"
              : "Transfer completed successfully",
        );
        if (form.type === "expense" && typeof window !== "undefined") {
          window.localStorage.setItem(
            RECENT_KEY,
            JSON.stringify({
              category_id: form.category_id,
              subcategory_id: form.subcategory_id,
              account_id: form.account_id,
            }),
          );
        }
      }
      invalidate(["transactions", "accounts"]);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the transaction");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.from("transactions").delete().eq("id", editing.id);
    setSaving(false);
    setConfirmDelete(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Transaction deleted");
    invalidate(["transactions", "accounts"]);
    onOpenChange(false);
  }

  const typeOptions: { value: TxType; label: string; cls: string }[] = [
    { value: "income", label: "Income", cls: "data-[on=true]:bg-income-soft data-[on=true]:text-income" },
    { value: "expense", label: "Expense", cls: "data-[on=true]:bg-expense-soft data-[on=true]:text-expense" },
    { value: "transfer", label: "Transfer", cls: "data-[on=true]:bg-saving-soft data-[on=true]:text-saving" },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>{editing ? "Edit transaction" : "Add transaction"}</DialogTitle>
            <DialogDescription>
              {form.type === "transfer"
                ? "Transfers move money between your accounts — they are not expenses."
                : "Record money coming in or going out."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-1">
              {typeOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  data-on={form.type === opt.value}
                  onClick={() => changeType(opt.value)}
                  className={cn(
                    "rounded-lg px-2 py-2 text-sm font-semibold text-muted-foreground transition-colors",
                    opt.cls,
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (৳)</Label>
              <Input
                id="amount"
                inputMode="decimal"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                className="tnum h-12 text-lg font-bold"
                autoFocus
              />
              {errors['amount'] && <p className="text-xs text-destructive">{errors['amount']}</p>}
            </div>

            {form.type === "income" && (
              <>
                <Field label="Income source" error={errors['income_source_id']}>
                  <Picker
                    value={form.income_source_id}
                    onChange={(v) => set("income_source_id", v)}
                    options={incomeSources}
                    placeholder="Select source"
                  />
                </Field>
                <Field label="Received to" error={errors['account_id']}>
                  <Picker
                    value={form.account_id}
                    onChange={(v) => set("account_id", v)}
                    options={activeAccounts}
                    placeholder="Select account"
                  />
                </Field>
              </>
            )}

            {form.type === "expense" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Category" error={errors['category_id']}>
                    <Picker
                      value={form.category_id}
                      onChange={(v) => set("category_id", v)}
                      options={categories}
                      placeholder="Select category"
                    />
                  </Field>
                  <Field label="Subcategory">
                    <Picker
                      value={form.subcategory_id}
                      onChange={(v) => set("subcategory_id", v)}
                      options={subsForCategory}
                      placeholder={form.category_id ? "Optional" : "Pick category first"}
                      disabled={!form.category_id}
                      allowNone
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Paid from" error={errors['account_id']}>
                    <Picker
                      value={form.account_id}
                      onChange={(v) => set("account_id", v)}
                      options={activeAccounts}
                      placeholder="Select account"
                    />
                  </Field>
                  <Field label="Purpose / Event">
                    <Picker
                      value={form.event_id}
                      onChange={(v) => set("event_id", v)}
                      options={events}
                      placeholder="Optional"
                      allowNone
                    />
                  </Field>
                </div>
              </>
            )}

            {form.type === "transfer" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="From account" error={errors['from_account_id']}>
                    <Picker
                      value={form.from_account_id}
                      onChange={(v) => set("from_account_id", v)}
                      options={activeAccounts}
                      placeholder="Select account"
                    />
                  </Field>
                  <Field label="To account" error={errors['to_account_id']}>
                    <Picker
                      value={form.to_account_id}
                      onChange={(v) => set("to_account_id", v)}
                      options={activeAccounts}
                      placeholder="Select account"
                    />
                  </Field>
                </div>
                <Field label="Purpose">
                  <Input
                    value={form.transfer_purpose}
                    onChange={(e) => set("transfer_purpose", e.target.value)}
                    placeholder="e.g. Personal Savings, Family Savings"
                    maxLength={200}
                  />
                </Field>
              </>
            )}

            <Field label="Date" error={errors['transaction_date']}>
              <Input
                type="date"
                value={form.transaction_date}
                onChange={(e) => set("transaction_date", e.target.value)}
              />
            </Field>

            <Field label="Note">
              <Textarea
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
                placeholder="Optional details"
                rows={2}
                maxLength={500}
              />
            </Field>

            <DialogFooter className="flex-row gap-2 pt-1">
              {editing && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setConfirmDelete(true)}
                  aria-label="Delete transaction"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the record. Your account balances, budgets and reports will
              be recalculated automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function Picker({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  allowNone,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
  placeholder: string;
  disabled?: boolean | undefined;
  allowNone?: boolean;
}) {
  return (
    <Select
      value={value || NONE}
      onValueChange={(v) => onChange(v === NONE ? "" : v)}
      disabled={disabled ?? false}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder}>
          {value ? (options.find((o) => o.id === value)?.name ?? placeholder) : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>None</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
