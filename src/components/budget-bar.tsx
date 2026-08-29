import { AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatBDT } from "@/lib/finance";
import { cn } from "@/lib/utils";

export function BudgetBar({
  name,
  budget,
  spent,
}: {
  name: string;
  budget: number;
  spent: number;
}) {
  const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
  const over = spent > budget;
  const remaining = budget - spent;

  return (
    <li>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold">{name}</span>
        <span className="tnum shrink-0 text-xs text-muted-foreground">
          {formatBDT(spent)} / {formatBDT(budget)}
        </span>
      </div>
      <Progress
        value={Math.min(pct, 100)}
        className={cn("h-2", over && "[&>div]:bg-destructive")}
      />
      <div className="mt-1 flex items-center justify-between text-xs">
        {over ? (
          <span className="over-budget flex items-center gap-1 font-semibold">
            <AlertTriangle className="h-3 w-3" />
            Over budget by {formatBDT(Math.abs(remaining))}
          </span>
        ) : (
          <span className="text-muted-foreground">Remaining {formatBDT(remaining)}</span>
        )}
        <span className={cn("tnum font-semibold", over ? "over-budget" : "text-muted-foreground")}>
          {pct}% used
        </span>
      </div>
    </li>
  );
}
