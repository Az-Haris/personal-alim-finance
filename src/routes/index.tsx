import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TakaFlow — Personal Finance Manager" },
      {
        name: "description",
        content:
          "Track income, expenses, savings, budgets and account balances in Bangladeshi Taka. Money in, money out, money saved — always clear.",
      },
      { property: "og:title", content: "TakaFlow — Personal Finance Manager" },
      {
        property: "og:description",
        content: "Track income, expenses, savings, budgets and account balances in Bangladeshi Taka.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      navigate({ to: data.session ? "/dashboard" : "/auth", replace: true });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Wallet className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">Loading TakaFlow…</p>
    </div>
  );
}
