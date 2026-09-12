import type { ReactNode } from "react";
import { Card } from "@heroui/react";
import { Link } from "react-router-dom";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="app-shell relative flex min-h-svh items-center justify-center overflow-hidden px-5 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,oklch(0.88_0.05_185_/_0.45),transparent_40%),radial-gradient(circle_at_85%_15%,oklch(0.9_0.04_220_/_0.35),transparent_35%)]"
      />
      <Card className="glass-panel fade-in relative z-10 w-full max-w-md rounded-[1.75rem] p-1.5">
        <Card.Header className="gap-3 px-7 pt-7">
          <Link to="/" className="font-brand text-base font-semibold text-foreground">
            Item<span className="text-[var(--accent)]">AI</span>
          </Link>
          <Card.Title className="font-display text-3xl font-semibold tracking-tight">{title}</Card.Title>
          <Card.Description className="text-[0.95rem] leading-relaxed text-muted">{subtitle}</Card.Description>
        </Card.Header>
        <Card.Content className="px-7 pb-7 pt-1">{children}</Card.Content>
      </Card>
    </main>
  );
}
