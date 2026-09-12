import { IconSearch } from "@tabler/icons-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, Input, Label, Modal, TextArea } from "@heroui/react";
import { cn } from "cn";

import {
  createPromptTemplate,
  deletePromptTemplate,
  listPromptTemplates,
  updatePromptTemplate,
  type PromptTemplate,
} from "./api";
import { PageHeader } from "@/components/page-header";
import { StatusBanner } from "@/components/status-banner";

type OwnershipFilter = "all" | "mine" | "shared";

export function PromptsPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return templates.filter((template) => {
      if (ownershipFilter === "mine" && !template.can_edit) return false;
      if (ownershipFilter === "shared" && template.can_edit) return false;
      if (!query) return true;
      return (
        template.title.toLowerCase().includes(query) ||
        template.body.toLowerCase().includes(query)
      );
    });
  }, [templates, searchQuery, ownershipFilter]);

  function resetForm() {
    setTitle("");
    setBody("");
    setShowForm(false);
    setEditingId(null);
  }

  function handleFormOpenChange(open: boolean) {
    if (open) {
      setShowForm(true);
      setError(null);
      return;
    }
    resetForm();
    setError(null);
  }

  function openCreateModal() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setShowForm(true);
    setError(null);
  }

  async function refresh() {
    setTemplates(await listPromptTemplates());
  }

  useEffect(() => {
    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load templates");
    });
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = { title: title.trim(), body: body.trim() };
      if (editingId) {
        await updatePromptTemplate(editingId, payload);
      } else {
        await createPromptTemplate(payload);
      }
      resetForm();
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save template");
    } finally {
      setBusy(false);
    }
  }

  function onEdit(template: PromptTemplate) {
    setEditingId(template.id);
    setTitle(template.title);
    setBody(template.body);
    setShowForm(true);
    setError(null);
  }

  async function onDelete(id: number) {
    setBusy(true);
    setDeletingId(id);
    setError(null);
    try {
      await deletePromptTemplate(id);
      if (editingId === id) {
        resetForm();
      }
      setExpandedIds((current) => current.filter((itemId) => itemId !== id));
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete template");
    } finally {
      setBusy(false);
      setDeletingId(null);
    }
  }

  async function onCopy(template: PromptTemplate) {
    try {
      await navigator.clipboard.writeText(template.body);
      setCopiedId(template.id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === template.id ? null : current));
      }, 1800);
    } catch {
      setError("Could not copy prompt");
    }
  }

  function toggleExpanded(id: number) {
    setExpandedIds((current) =>
      current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id],
    );
  }

  const ownershipTabs: { value: OwnershipFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "mine", label: "My Templates" },
    { value: "shared", label: "Shared" },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="Prompt templates"
        description="Review a template and copy the text into a profile."
        action={
          <Button className="shrink-0" onPress={openCreateModal}>
            Create template
          </Button>
        }
      />
      {error ? <StatusBanner>{error}</StatusBanner> : null}

      <Modal.Backdrop isOpen={showForm} onOpenChange={handleFormOpenChange}>
        <Modal.Container size="lg" scroll="inside" placement="center">
          <Modal.Dialog className="glass-panel">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{editingId ? "Edit template" : "New template"}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <form className="flex flex-col gap-5" onSubmit={onSubmit}>
                <div className="space-y-2.5">
                  <Label htmlFor="template-title">Title</Label>
                  <Input
                    id="template-title"
                    fullWidth
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    disabled={busy}
                  />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="template-body">Prompt text</Label>
                  <TextArea
                    id="template-body"
                    fullWidth
                    rows={8}
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    required
                    disabled={busy}
                  />
                </div>
                <div className="flex flex-wrap gap-2 pb-2">
                  <Button
                    type="submit"
                    isDisabled={busy || !title.trim() || !body.trim()}
                    isPending={busy}
                  >
                    {editingId ? "Save template" : "Add template"}
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    isDisabled={busy}
                    onPress={() => handleFormOpenChange(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {templates.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input
              fullWidth
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by title or prompt text…"
              className="pl-9"
              aria-label="Search prompt templates"
            />
          </div>
          <div
            className="flex shrink-0 rounded-xl border border-divider bg-background p-1"
            role="tablist"
            aria-label="Filter by ownership"
          >
            {ownershipTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={ownershipFilter === tab.value}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors",
                  ownershipFilter === tab.value
                    ? "bg-foreground text-background"
                    : "text-muted hover:text-foreground",
                )}
                onClick={() => setOwnershipFilter(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {templates.length === 0 ? (
          <p className="text-sm text-muted">No templates yet. Click “Create template”.</p>
        ) : filteredTemplates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-divider px-4 py-8 text-center text-sm text-muted">
            No templates match your search or filter.
          </p>
        ) : (
          filteredTemplates.map((template, index) => {
            const expanded = expandedIds.includes(template.id);
            const isLong = template.body.length > 160 || template.body.split("\n").length > 3;
            const isCopied = copiedId === template.id;

            return (
              <Card
                key={template.id}
                className="lift-card glass-panel fade-in rounded-3xl p-1"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <Card.Content className="flex flex-col gap-4 px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-display text-lg font-semibold">{template.title}</h2>
                      <Chip
                        className="mt-2.5"
                        size="sm"
                        color={template.can_edit ? "accent" : "default"}
                        variant="soft"
                      >
                        {template.can_edit ? "Your template" : "Shared"}
                      </Chip>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <Button
                        variant={isCopied ? "primary" : "outline"}
                        size="sm"
                        isDisabled={busy}
                        onPress={() => void onCopy(template)}
                        className={cn(isCopied && "pointer-events-none")}
                      >
                        {isCopied ? "Copied" : "Copy"}
                      </Button>
                      {template.can_edit ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            isDisabled={busy}
                            onPress={() => onEdit(template)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger-soft"
                            size="sm"
                            isDisabled={busy}
                            isPending={deletingId === template.id}
                            onPress={() => void onDelete(template.id)}
                          >
                            Delete
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p
                      className={cn(
                        "whitespace-pre-wrap text-sm leading-6 text-muted",
                        !expanded && "line-clamp-3",
                      )}
                    >
                      {template.body}
                    </p>
                    {isLong ? (
                      <button
                        type="button"
                        className="text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
                        onClick={() => toggleExpanded(template.id)}
                      >
                        {expanded ? "Show less" : "Show more"}
                      </button>
                    ) : null}
                  </div>
                </Card.Content>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
