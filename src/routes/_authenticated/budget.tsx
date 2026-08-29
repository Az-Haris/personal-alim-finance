import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Target, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/stat-card";
import { BudgetBar } from "@/routes/_authenticated/dashboard";
import { useFinanceData, useInvalidateFinance } from "@/hooks/use-finance";
import { useMonth } from "@/lib/month-context";
import { expenseByCategory, formatBDT } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/budget")({
  head: () => ({
    meta: [
      { title: "Monthly Budget — TakaFlow" },
      { name: "description", content: "Set category budgets for the month and compare them against your actual spending." },
      { property: "og:title", content: "Monthly Budget — TakaFlow" },
      { property: "og:description", content: "Set category budgets and track budget vs actual spending." },
    ],
  }),
  component: BudgetPage,
});

function BudgetPage() {
  const data = useFinanceData();
  const invalidate = useInvalidateFinance();
  const { year, month, label } = useMonth();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const monthBudgets = useMemo(
    () => data.budgets.filter((b) => b.year === year && b.month === month),
    [data.budgets, year, month],
  );

  const spend = useMemo(
    () => expenseByCategory(data.transactions, year, month),
    [data.transactions, year, month],
  );

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const c of data.categories) {
      const b = monthBudgets.find((x) => x.category_id === c.id);
      next[c.id] = b ? String(Number(b.amount)) : "";
    }
    setDrafts(next);
  }, [data.categories, monthBudgets]);

  const totalBudget = monthBudgets.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = monthBudgets.reduce((s, b) => s + (spend.get(b.category_id) ?? 0), 0);

  async function saveBudgets() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("You are signed out");

      const rows = [];
      const toDelete = [];
      for (const c of data.categories) {
        const raw = (drafts[c.id] ?? "").trim();
        if (raw === "") {
          const existing = monthBudgets.find((b) => b.category_id === c.id);
          if (existing) toDelete.push(existing.id);
          continue;
        }
        const amount = Number(raw);
        if (!Number.isFinite(amount) || amount < 0) {
          throw new Error(`Budget for ${c.name} cannot be negative`);
        }
        rows.push({ user_id: userId, year, month, category_id: c.id, amount });
      }

      if (toDelete.length > 0) {
        const { error } = await supabase.from("budgets").delete().in("id", toDelete);
        if (error) throw error;
      }
      if (rows.length > 0) {
        const { error } = await supabase
          .from("budgets")
          .upsert(rows, { onConflict: "user_id,year,month,category_id" });
        if (error) throw error;
      }
      toast.success("Budget updated successfully");
      invalidate(["budgets"]);
      setEditMode(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save budget");
    } finally {
      setSaving(false);
    }
  }

  const rows = data.categories
    .map((c) => {
      const b = monthBudgets.find((x) => x.category_id === c.id);
      return {
        id: c.id,
        name: c.name,
        budget: b ? Number(b.amount) : 0,
        spent: spend.get(c.id) ?? 0,
      };
    })
    .filter((r) => r.budget > 0 || r.spent > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monthly Budget"
        description={`Budget vs actual spending for ${label}.`}
        action={
          editMode ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditMode(false)}>
                Cancel
              </Button>
              <Button onClick={saveBudgets} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save budget
              </Button>
            </div>
          ) : (
            <Button onClick={() => setEditMode(true)}>
              <Target className="h-4 w-4" />
              {monthBudgets.length > 0 ? "Edit budget" : "Create budget"}
            </Button>
          )
        }
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total budget" value={totalBudget} icon={Target} />
        <StatCard label="Spent" value={totalSpent} icon={Target} tone="expense" />
        <StatCard
          label={totalSpent > totalBudget ? "Over budget" : "Remaining"}
          value={Math.abs(totalBudget - totalSpent)}
          icon={Target}
          tone={totalSpent > totalBudget ? "expense" : "income"}
        />
      </div>

      {editMode ? (
        <SectionCard
          title={`Set budgets for ${label}`}
          description="Leave a category blank to remove its budget."
        >
          <div className="space-y-3">
            {data.categories.map((c) => (
              <div key={c.id} className="flex items-center gap-3">
                <label htmlFor={`b-${c.id}`} className="flex-1 truncate text-sm font-medium">
                  {c.name}
                </label>
                <div className="relative w-36">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ৳
                  </span>
                  <Input
                    id={`b-${c.id}`}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={drafts[c.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [c.id]: e.target.value }))}
                    className="tnum pl-7 text-right"
                  />
                </div>
              </div>
            ))}
          </div>
          <Button className="mt-5 w-full" onClick={saveBudgets} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save budget
          </Button>
        </SectionCard>
      ) : (
        <SectionCard title="Category progress" description={label}>
          {rows.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No budget created for this month"
              description="Set spending limits per category and TakaFlow will track your progress automatically."
              action={<Button onClick={() => setEditMode(true)}>Create Monthly Budget</Button>}
            />
          ) : (
            <ul className="space-y-4">
              {rows.map((r) =>
                r.budget > 0 ? (
                  <BudgetBar key={r.id} name={r.name} budget={r.budget} spent={r.spent} />
                ) : (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2.5"
                  >
                    <span className="text-sm font-medium">{r.name}</span>
                    <span className="text-xs text-muted-foreground">
                      No budget · spent{" "}
                      <span className="tnum font-semibold amount-expense">{formatBDT(r.spent)}</span>
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
        </SectionCard>
      )}
    </div>
  );
}
