import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, LogOut, Tags, PartyPopper, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { EmptyState, PageHeader, SectionCard } from "@/components/stat-card";
import { useFinanceData, useInvalidateFinance, useProfile } from "@/hooks/use-finance";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — TakaFlow" },
      { name: "description", content: "Manage your profile, expense categories, subcategories, income sources and events." },
      { property: "og:title", content: "Settings — TakaFlow" },
      { property: "og:description", content: "Manage profile, categories, income sources and events." },
    ],
  }),
  component: SettingsPage,
});

type DeleteTarget = { table: string; id: string; name: string } | null;

function SettingsPage() {
  const data = useFinanceData();
  const profileQuery = useProfile();
  const profile = profileQuery.data ?? null;
  const invalidate = useInvalidateFinance();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [target, setTarget] = useState<DeleteTarget>(null);

  useEffect(() => {
    if (profile?.name) setName(profile.name);
  }, [profile?.name]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name cannot be empty");
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: trimmed })
      .eq("user_id", profile!.user_id);
    setSavingProfile(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated successfully");
    invalidate(["profile"]);
  }

  async function confirmDelete() {
    if (!target) return;
    const { error } = await supabase.from(target.table as "events").delete().eq("id", target.id);
    if (error) {
      toast.error("Could not delete — it may still be used by transactions.");
    } else {
      toast.success(`${target.name} deleted`);
      invalidate();
    }
    setTarget(null);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Your profile and the lists that power the app." />

      <SectionCard title="Profile" description="Shown in the sidebar and greetings">
        <form onSubmit={saveProfile} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="profile-name">Display name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="Your name"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" value={profile?.email ?? ""} disabled />
          </div>
          <Button type="submit" disabled={savingProfile}>
            {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
            Save
          </Button>
        </form>
      </SectionCard>

      <ListManager
        title="Expense categories"
        description="Top-level buckets for your spending"
        icon={Tags}
        table="expense_categories"
        items={data.categories}
        onDelete={(id, n) => setTarget({ table: "expense_categories", id, name: n })}
      />

      <SubcategoryManager
        categories={data.categories}
        subcategories={data.subcategories}
        onDelete={(id, n) => setTarget({ table: "expense_subcategories", id, name: n })}
      />

      <ListManager
        title="Income sources"
        description="Salary, business, gifts and more"
        icon={Tags}
        table="income_categories"
        items={data.incomeSources}
        onDelete={(id, n) => setTarget({ table: "income_categories", id, name: n })}
      />

      <EventManager
        events={data.events}
        onDelete={(id, n) => setTarget({ table: "events", id, name: n })}
      />

      <SectionCard title="Session">
        <Button variant="outline" onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </SectionCard>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{target?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. If existing transactions use it, the delete will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function useAdder(table: "expense_categories" | "income_categories") {
  const invalidate = useInvalidateFinance();
  return async (name: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from(table)
      .insert({ user_id: userData.user!.id, name });
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Added successfully");
    invalidate();
    return true;
  };
}

function ListManager({
  title,
  description,
  icon,
  table,
  items,
  onDelete,
}: {
  title: string;
  description: string;
  icon: typeof Tags;
  table: "expense_categories" | "income_categories";
  items: { id: string; name: string }[];
  onDelete: (id: string, name: string) => void;
}) {
  const add = useAdder(table);
  const [value, setValue] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    if (items.some((i) => i.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("That name already exists");
      return;
    }
    if (await add(trimmed)) setValue("");
  }

  return (
    <SectionCard title={title} description={description}>
      <form onSubmit={submit} className="mb-4 flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Add to ${title.toLowerCase()}`}
          maxLength={50}
        />
        <Button type="submit">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </form>
      {items.length === 0 ? (
        <EmptyState icon={icon} title="Nothing here yet" description="Add your first entry above." />
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((i) => (
            <span
              key={i.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 py-1.5 pl-3 pr-1.5 text-sm font-medium"
            >
              {i.name}
              <button
                onClick={() => onDelete(i.id, i.name)}
                aria-label={`Delete ${i.name}`}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function SubcategoryManager({
  categories,
  subcategories,
  onDelete,
}: {
  categories: { id: string; name: string }[];
  subcategories: { id: string; name: string; category_id: string }[];
  onDelete: (id: string, name: string) => void;
}) {
  const invalidate = useInvalidateFinance();
  const [categoryId, setCategoryId] = useState("");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!categoryId && categories[0]) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || !categoryId) return;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("expense_subcategories").insert({
      user_id: userData.user!.id,
      category_id: categoryId,
      name: trimmed,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Subcategory added successfully");
    setValue("");
    invalidate();
  }

  return (
    <SectionCard title="Subcategories" description="More detail inside each expense category">
      <form onSubmit={submit} className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="sm:w-52">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="New subcategory"
          maxLength={50}
        />
        <Button type="submit">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </form>

      {categories.length === 0 ? (
        <EmptyState icon={Tags} title="Add a category first" description="Subcategories live inside categories." />
      ) : (
        <div className="space-y-4">
          {categories.map((c) => {
            const subs = subcategories.filter((s) => s.category_id === c.id);
            if (subs.length === 0) return null;
            return (
              <div key={c.id}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {c.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {subs.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 py-1.5 pl-3 pr-1.5 text-sm font-medium"
                    >
                      {s.name}
                      <button
                        onClick={() => onDelete(s.id, s.name)}
                        aria-label={`Delete ${s.name}`}
                        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function EventManager({
  events,
  onDelete,
}: {
  events: { id: string; name: string; description: string | null; start_date: string | null }[];
  onDelete: (id: string, name: string) => void;
}) {
  const invalidate = useInvalidateFinance();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("events").insert({
      user_id: userData.user!.id,
      name: trimmed,
      description: description.trim() || null,
      start_date: startDate || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event added successfully");
    setName("");
    setDescription("");
    setStartDate("");
    invalidate();
  }

  return (
    <SectionCard title="Events & purposes" description="Group spending for trips, weddings or projects">
      <form onSubmit={submit} className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Event name"
          maxLength={60}
        />
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          maxLength={140}
        />
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Button type="submit">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </form>

      {events.length === 0 ? (
        <EmptyState
          icon={PartyPopper}
          title="No events yet"
          description="Create an event like “Kuakata Tour” and tag expenses to it."
        />
      ) : (
        <ul className="divide-y divide-border">
          {events.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{e.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[e.description, e.start_date].filter(Boolean).join(" · ") || "No details"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${e.name}`}
                onClick={() => onDelete(e.id, e.name)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
