import { type FormEvent, useEffect, useState } from "react";

import {
  createPromptTemplate,
  deletePromptTemplate,
  listPromptTemplates,
  updatePromptTemplate,
  type PromptTemplate,
} from "./api";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Prompt templates"
        description="Review a template and copy the text into a profile."
        action={
          !showForm ? (
            <Button className="shrink-0" onClick={() => setShowForm(true)}>
              Create template
            </Button>
          ) : null
        }
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit template" : "New template"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="template-title">Title</Label>
                <Input
                  id="template-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-body">Prompt text</Label>
                <Textarea
                  id="template-body"
                  rows={6}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  required
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>
                  {editingId ? "Save template" : "Add template"}
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    resetForm();
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates yet. Click “Create template”.</p>
        ) : (
          templates.map((template) => (
            <Card key={template.id} size="sm">
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-medium">{template.title}</h2>
                    <Badge className="mt-2" variant={template.can_edit ? "secondary" : "outline"}>
                      {template.can_edit ? "Your template" : "Shared"}
                    </Badge>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => void onCopy(template)}>
                      {copiedId === template.id ? "Copied" : "Copy"}
                    </Button>
                    {template.can_edit ? (
                      <>
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => onEdit(template)}>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => void onDelete(template.id)}>
                          Delete
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{template.body}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
