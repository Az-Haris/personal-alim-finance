import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Account,
  Budget,
  Category,
  FinanceEvent,
  Profile,
  Subcategory,
  Tx,
} from "@/lib/finance";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ["expense-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export function useSubcategories() {
  return useQuery({
    queryKey: ["expense-subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_subcategories").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Subcategory[];
    },
  });
}

export function useIncomeSources() {
  return useQuery({
    queryKey: ["income-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("income_categories").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FinanceEvent[];
    },
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Tx[];
    },
  });
}

export function useBudgets() {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("budgets").select("*");
      if (error) throw error;
      return (data ?? []) as Budget[];
    },
  });
}

export function useFinanceData() {
  const accounts = useAccounts();
  const categories = useExpenseCategories();
  const subcategories = useSubcategories();
  const incomeSources = useIncomeSources();
  const events = useEvents();
  const transactions = useTransactions();
  const budgets = useBudgets();
  return {
    accounts: accounts.data ?? [],
    categories: categories.data ?? [],
    subcategories: subcategories.data ?? [],
    incomeSources: incomeSources.data ?? [],
    events: events.data ?? [],
    transactions: transactions.data ?? [],
    budgets: budgets.data ?? [],
    isLoading:
      accounts.isLoading ||
      categories.isLoading ||
      subcategories.isLoading ||
      incomeSources.isLoading ||
      events.isLoading ||
      transactions.isLoading ||
      budgets.isLoading,
  };
}

export function useInvalidateFinance() {
  const qc = useQueryClient();
  return (keys?: string[]) => {
    const all = [
      "transactions",
      "accounts",
      "budgets",
      "expense-categories",
      "expense-subcategories",
      "income-categories",
      "events",
      "profile",
    ];
    for (const k of keys ?? all) qc.invalidateQueries({ queryKey: [k] });
  };
}

export function nameOf(list: { id: string; name: string }[], id: string | null | undefined): string {
  if (!id) return "";
  return list.find((x) => x.id === id)?.name ?? "";
}
