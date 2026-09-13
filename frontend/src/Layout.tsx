import { Button, Toast } from "@heroui/react";
import { NavLink, Outlet } from "react-router-dom";
import { cn } from "cn";

import { useAuth } from "./auth";

function NavItem({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200",
          isActive
            ? "bg-[color-mix(in_oklch,var(--accent)_16%,white)] text-[var(--accent)]"
            : "text-muted hover:bg-white/60 hover:text-foreground",
        )
      }
    >
      {children}
    </NavLink>
  );
}

export function Layout() {
  const { logout, user } = useAuth();

  return (
    <div className="app-shell min-h-svh">
      <header className="sticky top-0 z-20 border-b border-white/40 bg-white/55 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-4 px-5 md:px-6">
          <NavLink to="/profiles" className="font-brand text-lg font-semibold text-foreground">
            Item<span className="text-[var(--accent)]">AI</span>
          </NavLink>
          <nav className="hidden items-center gap-1.5 md:flex">
            <NavItem to="/profiles">Profiles</NavItem>
            <NavItem to="/jobs">Jobs</NavItem>
            <NavItem to="/tariffs">Tariffs</NavItem>
            <NavItem to="/prompts">Prompt templates</NavItem>
            {user?.is_staff ? <NavItem to="/integrations">Integrations</NavItem> : null}
          </nav>
          <Button variant="outline" size="sm" onPress={logout}>
            Log out
          </Button>
        </div>
        <div className="mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-5 pb-3.5 md:hidden md:px-6">
          <NavItem to="/profiles">Profiles</NavItem>
          <NavItem to="/jobs">Jobs</NavItem>
          <NavItem to="/tariffs">Tariffs</NavItem>
          <NavItem to="/prompts">Prompt templates</NavItem>
          {user?.is_staff ? <NavItem to="/integrations">Integrations</NavItem> : null}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-6 md:py-14">
        <Outlet />
      </main>
      <Toast.Provider placement="top end" />
    </div>
  );
}
