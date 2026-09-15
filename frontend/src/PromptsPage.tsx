import { IconChevronDown, IconDots, IconPencil, IconSearch, IconTrash } from "@tabler/icons-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Button, Card, Chip, Dropdown, Input, Label, Modal, TextArea, toast } from "@heroui/react";
import { cn } from "cn";

import {
  createPromptTemplate,
  deletePromptTemplate,
  listPromptTemplates,
  listProfiles,
  updatePromptTemplate,
  updateProfile,
  PROMPT_TYPE_LABELS,
  type Profile,
  type PromptTemplate,
  type PromptType,
} from "./api";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { StatusBanner } from "@/components/status-banner";

type OwnershipFilter = "all" | "mine" | "shared";
type TypeFilter = "all" | PromptType;

const IMAGE_PROMPT_PLACEHOLDER_HINT =
  "Used with an uploaded product photo as reference. Placeholders: {title}, {description}, {short_description}, {product_type}, {tags}.";

export function PromptsPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [promptType, setPromptType] = useState<PromptType>("description");
  const [category, setCategory] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PromptTemplate | null>(null);
  const [applyingKey, setApplyingKey] = useState<string | null>(null);
  const [pendingApply, setPendingApply] = useState<{ template: PromptTemplate; profile: Profile } | null>(null);
  const [applyTarget, setApplyTarget] = useState<PromptType>("description");

  const ownProfiles = useMemo(() => profiles.filter((profile) => profile.can_edit), [profiles]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const template of templates) {
      if (template.category.trim()) set.add(template.category.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return templates.filter((template) => {
      if (ownershipFilter === "mine" && !template.can_edit) return false;
      if (ownershipFilter === "shared" && template.can_edit) return false;
      if (typeFilter !== "all" && template.prompt_type !== typeFilter) return false;
      if (categoryFilter && template.category !== categoryFilter) return false;
      if (!query) return true;
      return (
        template.title.toLowerCase().includes(query) ||
        template.body.toLowerCase().includes(query) ||
        template.category.toLowerCase().includes(query)
      );
    });
  }, [templates, searchQuery, ownershipFilter, typeFilter, categoryFilter]);

  function resetForm() {
    setTitle("");
    setBody("");
    setPromptType("description");
    setCategory("");
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
    setPromptType(typeFilter === "image" ? "image" : "description");
    setCategory(categoryFilter);
    setShowForm(true);
    setError(null);
  }

  async function refresh() {
    const [nextTemplates, nextProfiles] = await Promise.all([listPromptTemplates(), listProfiles()]);
    setTemplates(nextTemplates);
    setProfiles(nextProfiles);
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
      const payload = {
        title: title.trim(),
        body: body.trim(),
        prompt_type: promptType,
        category: category.trim(),
      };
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
    setPromptType(template.prompt_type);
    setCategory(template.category);
    setShowForm(true);
    setError(null);
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setBusy(true);
    setDeletingId(id);
    setError(null);
    try {
      await deletePromptTemplate(id);
      if (editingId === id) {
        resetForm();
      }
      setExpandedIds((current) => current.filter((itemId) => itemId !== id));
      setDeleteTarget(null);
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

  async function applyTemplate(template: PromptTemplate, profile: Profile, target: PromptType) {
    const key = `${template.id}:${profile.id}`;
    setApplyingKey(key);
    setError(null);
    try {
      if (target === "image") {
        await updateProfile(profile.id, { image_prompt: template.body });
        toast.success(`Applied "${template.title}" as the image prompt for ${profile.title}.`);
      } else {
        await updateProfile(profile.id, { Prompt: template.body, prompt_template: template.id });
        toast.success(`Applied "${template.title}" as the description prompt for ${profile.title}.`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not apply template to profile");
    } finally {
      setApplyingKey(null);
    }
  }

  function openApplyDialog(template: PromptTemplate, profile: Profile) {
    setApplyTarget(template.prompt_type);
    setPendingApply({ template, profile });
  }

  async function onConfirmApply() {
    if (!pendingApply) return;
    const { template, profile } = pendingApply;
    const target = applyTarget;
    setPendingApply(null);
    await applyTemplate(template, profile, target);
  }

  const pendingHasExisting = pendingApply
    ? (applyTarget === "image" ? pendingApply.profile.image_prompt : pendingApply.profile.Prompt).trim().length > 0
    : false;

  function toggleExpanded(id: number) {
    setExpandedIds((current) =>
      current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id],
    );
  }

  const ownershipTabs: { value: OwnershipFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "mine", label: "Mine" },
    { value: "shared", label: "Shared" },
  ];

  const typeTabs: { value: TypeFilter; label: string }[] = [
    { value: "all", label: "All types" },
    { value: "description", label: "Description" },
    { value: "image", label: "Image" },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="Prompt templates"
        description="Review a template, then apply it to one of your profiles in one click."
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
                <div className="grid gap-5 sm:grid-cols-2">
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
                    <Label htmlFor="template-type">Type</Label>
                    <NativeSelect
                      id="template-type"
                      value={promptType}
                      disabled={busy}
                      onChange={(event) => setPromptType(event.target.value as PromptType)}
                    >
                      <option value="description">Description</option>
                      <option value="image">Image</option>
                    </NativeSelect>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="template-category">Category (optional)</Label>
                  <Input
                    id="template-category"
                    fullWidth
                    list="template-categories"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    placeholder="e.g. Fashion, Electronics, Home"
                    disabled={busy}
                  />
                  <datalist id="template-categories">
                    {categories.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
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
                  {promptType === "image" ? (
                    <p className="text-xs leading-relaxed text-muted">{IMAGE_PROMPT_PLACEHOLDER_HINT}</p>
                  ) : null}
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

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete "${deleteTarget?.title ?? ""}"?`}
        description="This permanently removes the template. Profiles already using its text keep their saved prompt."
        confirmLabel="Delete template"
        busy={busy}
        onConfirm={() => void onConfirmDelete()}
      />

      <ConfirmDialog
        isOpen={pendingApply !== null}
        onOpenChange={(open) => {
          if (!open) setPendingApply(null);
        }}
        title={`Apply "${pendingApply?.template.title ?? ""}" to "${pendingApply?.profile.title ?? ""}"`}
        description={
          <div className="flex flex-col gap-3">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Apply as</p>
              <div className="flex gap-2" role="radiogroup" aria-label="Target field">
                {(["description", "image"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={applyTarget === option}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                      applyTarget === option
                        ? "border-foreground bg-foreground text-background"
                        : "border-divider text-muted hover:text-foreground",
                    )}
                    onClick={() => setApplyTarget(option)}
                  >
                    {PROMPT_TYPE_LABELS[option]} prompt
                  </button>
                ))}
              </div>
            </div>
            {pendingHasExisting ? (
              <p className="text-sm text-muted">
                This profile already has a custom {PROMPT_TYPE_LABELS[applyTarget].toLowerCase()} prompt. Applying
                will overwrite it. This cannot be undone.
              </p>
            ) : null}
          </div>
        }
        confirmLabel={pendingHasExisting ? "Replace prompt" : "Apply prompt"}
        destructive={false}
        busy={pendingApply !== null && applyingKey === `${pendingApply.template.id}:${pendingApply.profile.id}`}
        onConfirm={() => void onConfirmApply()}
      />

      {templates.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                fullWidth
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by title, prompt text, or category…"
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              className="flex shrink-0 rounded-xl border border-divider bg-background p-1"
              role="tablist"
              aria-label="Filter by type"
            >
              {typeTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === tab.value}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm transition-colors",
                    typeFilter === tab.value
                      ? "bg-foreground text-background"
                      : "text-muted hover:text-foreground",
                  )}
                  onClick={() => setTypeFilter(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {categories.length > 0 ? (
              <NativeSelect
                className="sm:w-56"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </NativeSelect>
            ) : null}
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
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <Chip size="sm" color={template.can_edit ? "accent" : "default"} variant="soft">
                          {template.can_edit ? "Your template" : "Shared"}
                        </Chip>
                        <Chip size="sm" color={template.prompt_type === "image" ? "accent" : "default"} variant="soft">
                          {PROMPT_TYPE_LABELS[template.prompt_type]}
                        </Chip>
                        {template.category ? (
                          <Chip size="sm" variant="secondary">
                            {template.category}
                          </Chip>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      {ownProfiles.length > 0 ? (
                        <Dropdown>
                          <Button variant="outline" size="sm" isDisabled={busy}>
                            Apply to profile
                            <IconChevronDown className="size-3.5" />
                          </Button>
                          <Dropdown.Popover placement="bottom end">
                            <Dropdown.Menu
                              aria-label={`Apply "${template.title}" to a profile`}
                              onAction={(key) => {
                                const profile = ownProfiles.find((item) => String(item.id) === key);
                                if (profile) openApplyDialog(template, profile);
                              }}
                            >
                              {ownProfiles.map((profile) => (
                                <Dropdown.Item key={profile.id} id={String(profile.id)} textValue={profile.title}>
                                  <Label>{profile.title}</Label>
                                </Dropdown.Item>
                              ))}
                            </Dropdown.Menu>
                          </Dropdown.Popover>
                        </Dropdown>
                      ) : null}
                      <Button
                        variant={isCopied ? "primary" : "ghost"}
                        size="sm"
                        isDisabled={busy}
                        onPress={() => void onCopy(template)}
                        className={cn(isCopied && "pointer-events-none")}
                      >
                        {isCopied ? "Copied" : "Copy"}
                      </Button>
                      {template.can_edit ? (
                        <Dropdown>
                          <Button
                            variant="ghost"
                            size="sm"
                            isDisabled={busy}
                            aria-label={`More actions for ${template.title}`}
                          >
                            <IconDots className="size-4" />
                          </Button>
                          <Dropdown.Popover placement="bottom end">
                            <Dropdown.Menu
                              aria-label="Template actions"
                              onAction={(key) => {
                                if (key === "edit") onEdit(template);
                                if (key === "delete") setDeleteTarget(template);
                              }}
                              disabledKeys={busy ? (["edit", "delete"] as const) : []}
                            >
                              <Dropdown.Item id="edit" textValue="Edit">
                                <IconPencil className="size-4" />
                                <Label>Edit</Label>
                              </Dropdown.Item>
                              <Dropdown.Item id="delete" textValue="Delete" variant="danger">
                                <IconTrash className="size-4" />
                                <Label>{deletingId === template.id ? "Deleting…" : "Delete"}</Label>
                              </Dropdown.Item>
                            </Dropdown.Menu>
                          </Dropdown.Popover>
                        </Dropdown>
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
