import type { ReactNode } from "react";

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1.5 text-xs text-muted-foreground">{children}</p>;
}
