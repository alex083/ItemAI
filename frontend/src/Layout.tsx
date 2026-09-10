import { NavLink, Navigate, Outlet } from "react-router-dom";
import { cn } from "cn";

import { useAuth } from "./auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

function NavItem({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "rounded-3xl px-3 py-1.5 text-sm font-medium transition-colors",
          isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
        )
      }
    >
      {children}
    </NavLink>
  );
}

export function Layout() {
  const { loggedIn, logout, user } = useAuth();

  if (!loggedIn) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <NavLink to="/profiles" className="font-heading text-sm font-medium tracking-tight">
            ItemAI
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex">
            <NavItem to="/profiles">Profiles</NavItem>
            <NavItem to="/prompts">Prompt templates</NavItem>
            {user?.is_staff ? <NavItem to="/integrations">Integrations</NavItem> : null}
          </nav>
          <Button variant="outline" size="sm" onClick={logout}>
            Log out
          </Button>
        </div>
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-3 md:hidden">
          <NavItem to="/profiles">Profiles</NavItem>
          <NavItem to="/prompts">Prompt templates</NavItem>
          {user?.is_staff ? <NavItem to="/integrations">Integrations</NavItem> : null}
        </div>
      </header>
      <Separator className="md:hidden" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
