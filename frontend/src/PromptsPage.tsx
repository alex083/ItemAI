import { type FormEvent, useEffect, useState } from "react";
import { Button, Card, Chip, Input, Label, TextArea } from "@heroui/react";

import {
  createPromptTemplate,
  deletePromptTemplate,
  listPromptTemplates,
  updatePromptTemplate,
  type PromptTemplate,
} from "./api";
import { PageHeader } from "@/components/page-header";
import { StatusBanner } from "@/components/status-banner";

export function PromptsPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetForm() {
    setTitle("");
    setBody("");
    setShowForm(false);
    setEditingId(null);
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
    setError(null);
    try {
      await deletePromptTemplate(id);
      if (editingId === id) {
        resetForm();
      }
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete template");
    } finally {
      setBusy(false);
    }
  }

  async function onCopy(template: PromptTemplate) {
    try {
      await navigator.clipboard.writeText(template.body);
      setCopiedId(template.id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === template.id ? null : current));
      }, 1500);
    } catch {
      setError("Could not copy prompt");
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Prompt templates"
        description="Review a template and copy the text into a profile."
        action={
          !showForm ? (
            <Button className="shrink-0" onPress={() => setShowForm(true)}>
              Create template
            </Button>
          ) : null
        }
      />
      {error ? <StatusBanner>{error}</StatusBanner> : null}

      {showForm ? (
        <Card className="glass-panel fade-in rounded-3xl p-1">
          <Card.Header className="px-6 pt-6">
            <Card.Title>{editingId ? "Edit template" : "New template"}</Card.Title>
          </Card.Header>
          <Card.Content className="px-6 pb-6">
            <form className="flex flex-col gap-5" onSubmit={onSubmit}>
              <div className="space-y-2.5">
                <Label htmlFor="template-title">Title</Label>
                <Input
                  id="template-title"
                  fullWidth
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="template-body">Prompt text</Label>
                <TextArea
                  id="template-body"
                  fullWidth
                  rows={6}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  required
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" isDisabled={busy} isPending={busy}>
                  {editingId ? "Save template" : "Add template"}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  isDisabled={busy}
                  onPress={() => {
                    resetForm();
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        {templates.length === 0 ? (
          <p className="text-sm text-muted">No templates yet. Click “Create template”.</p>
        ) : (
          templates.map((template, index) => (
            <Card
              key={template.id}
              className="lift-card glass-panel fade-in rounded-3xl p-1"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <Card.Content className="flex flex-col gap-4 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-semibold">{template.title}</h2>
                    <Chip className="mt-2.5" size="sm" color={template.can_edit ? "accent" : "default"} variant="soft">
                      {template.can_edit ? "Your template" : "Shared"}
                    </Chip>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onPress={() => void onCopy(template)}>
                      {copiedId === template.id ? "Copied" : "Copy"}
                    </Button>
                    {template.can_edit ? (
                      <>
                        <Button variant="outline" size="sm" isDisabled={busy} onPress={() => onEdit(template)}>
                          Edit
                        </Button>
                        <Button
                          variant="danger-soft"
                          size="sm"
                          isDisabled={busy}
                          onPress={() => void onDelete(template.id)}
                        >
                          Delete
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted">{template.body}</p>
              </Card.Content>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
