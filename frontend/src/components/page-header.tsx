import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="fade-in flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2.5 max-w-xl text-[0.95rem] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
