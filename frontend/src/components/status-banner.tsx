import type { ReactNode } from "react";
import { Alert } from "@heroui/react";

export function StatusBanner({
  children,
  status = "danger",
}: {
  children: ReactNode;
  status?: "default" | "accent" | "success" | "warning" | "danger";
}) {
  return (
    <Alert status={status} className="fade-in">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{children}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
