import { Button, Modal } from "@heroui/react";
import type { ReactNode } from "react";

export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  busy = false,
  onConfirm,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="sm" scroll="inside" placement="center">
        <Modal.Dialog className="glass-panel">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="flex flex-col gap-5">
              {description ? (
                <div className="text-sm leading-relaxed text-muted">{description}</div>
              ) : null}
              <div className="flex flex-wrap gap-2 pb-2">
                <Button
                  type="button"
                  variant={destructive ? "danger-soft" : "primary"}
                  isDisabled={busy}
                  isPending={busy}
                  onPress={onConfirm}
                >
                  {confirmLabel}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  isDisabled={busy}
                  onPress={() => onOpenChange(false)}
                >
                  {cancelLabel}
                </Button>
              </div>
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
