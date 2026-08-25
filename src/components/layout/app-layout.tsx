import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Target,
  BarChart3,
  Settings as SettingsIcon,
  Wallet,
  Plus,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { MonthProvider, useMonth } from "@/lib/month-context";
import { useProfile } from "@/hooks/use-finance";
import { TransactionDialog } from "@/components/transaction-dialog";
import { MONTH_NAMES } from "@/lib/finance";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/income", label: "Income", icon: TrendingUp },
  { to: "/expenses", label: "Expenses", icon: TrendingDown },
  { to: "/accounts", label: "Savings & Accounts", icon: PiggyBank },
  { to: "/budget", label: "Monthly Budget", icon: Target },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

const MOBILE_NAV = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/transactions", label: "History", icon: ArrowLeftRight },
  { to: "/budget", label: "Budget", icon: Target },
  { to: "/accounts", label: "Accounts", icon: PiggyBank },
] as const;

export function AppLayout() {
  return (
    <MonthProvider>
      <LayoutInner />
    </MonthProvider>
  );
}

function LayoutInner() {
  const [addOpen, setAddOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <BrandBlock />
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <Button className="w-full" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Transaction
          </Button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <TopHeader onAdd={() => setAddOpen(true)} onOpenNav={() => setMobileNavOpen(true)} />
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <MobileTabBar onAdd={() => setAddOpen(true)} />

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <BrandBlock />
          <nav className="space-y-1 px-3 py-2" onClick={() => setMobileNavOpen(false)}>
            {NAV.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <TransactionDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function BrandBlock() {
  return (
    <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Wallet className="h-4.5 w-4.5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-extrabold tracking-tight">TakaFlow</p>
        <p className="text-xs text-muted-foreground">Personal finance</p>
      </div>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === to;
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" />
      {label}
    </Link>
  );
}

function TopHeader({ onAdd, onOpenNav }: { onAdd: () => void; onOpenNav: () => void }) {
  const { label, shiftMonth, isCurrentMonth, goToCurrentMonth, year, setMonth } = useMonth();
  const { data: profile } = useProfile();
  const navigate = useNavigate();

  const initials = (profile?.name ?? profile?.email ?? "U")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenNav}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
        </Sheet>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="min-w-[9.5rem] gap-2 font-semibold">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                {label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
              <DropdownMenuLabel>Jump to month</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {[year, year - 1].map((y) =>
                MONTH_NAMES.map((m, i) => (
                  <DropdownMenuItem key={`${y}-${i}`} onClick={() => setMonth(y, i + 1)}>
                    {m} {y}
                  </DropdownMenuItem>
                )),
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isCurrentMonth && (
            <Button variant="ghost" size="sm" onClick={goToCurrentMonth} className="hidden sm:inline-flex">
              Today
            </Button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button className="hidden sm:inline-flex" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            Add Transaction
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-accent text-xs font-bold text-accent-foreground">
                    {initials || "U"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">
                <span className="block font-semibold">{profile?.name ?? "Your account"}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {profile?.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <SettingsIcon className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

function MobileTabBar({ onAdd }: { onAdd: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pb-[env(safe-area-inset-bottom)]">
        {MOBILE_NAV.slice(0, 2).map((item) => (
          <TabLink key={item.to} {...item} active={pathname === item.to} />
        ))}
        <div className="flex justify-center pb-1.5">
          <button
            onClick={onAdd}
            aria-label="Add transaction"
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-raised transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
        {MOBILE_NAV.slice(2).map((item) => (
          <TabLink key={item.to} {...item} active={pathname === item.to} />
        ))}
      </div>
    </nav>
  );
}

function TabLink({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center gap-1 py-2.5 text-[0.68rem] font-medium transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}
