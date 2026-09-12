import {
  IconChevronDown,
  IconCpu,
  IconEye,
  IconFileSpreadsheet,
  IconLoader2,
  IconSearch,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { type DragEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Input, Label, Modal, Skeleton, TextArea } from "@heroui/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { cn } from "cn";

import {
  allowedKeyModes,
  createProduct,
  deleteProduct,
  exportProductsToCsv,
  generateProduct,
  getMySubscription,
  getProfile,
  importProductsFromCsv,
  listAvailableModels,
  listIntegrations,
  listProducts,
  updateProfile,
  type Integration,
  type KeyPolicy,
  type Product,
  type Profile,
  type ProfileKeyMode,
  type ProviderModel,
} from "./api";
import { FieldHint } from "@/components/field-hint";
import { NativeSelect } from "@/components/native-select";
import { StatusBanner } from "@/components/status-banner";

const EXPORT_FIELDS: { value: string; label: string }[] = [
  { value: "title", label: "Title" },
  { value: "external_id", label: "External ID" },
  { value: "barcode", label: "Barcode" },
  { value: "group_id", label: "Group ID" },
  { value: "product_type", label: "Product type" },
  { value: "tags", label: "Tags" },
  { value: "short_description", label: "Short description" },
  { value: "description", label: "Description" },
  { value: "meta_title", label: "Meta title" },
  { value: "meta_description", label: "Meta description" },
  { value: "bullet_points", label: "Bullet points" },
  { value: "google_product_category", label: "Google category" },
  { value: "google_product_category_path", label: "Google category path" },
  { value: "image_url", label: "Primary image URL" },
  { value: "image_urls", label: "All image URLs" },
];

const DEFAULT_EXPORT_FIELDS = [
  "title",
  "external_id",
  "product_type",
  "tags",
  "short_description",
  "description",
  "bullet_points",
  "google_product_category",
  "image_url",
];

type StatusFilter = "all" | "generated" | "empty";

function productHasGeneratedContent(product: Product) {
  return Boolean(
    product.description?.trim() ||
      product.short_description?.trim() ||
      product.meta_title?.trim() ||
      product.meta_description?.trim() ||
      (product.bullet_points?.length ?? 0) > 0,
  );
}

function ProfileDetailSkeleton() {
  return (
    <div className="page-stack">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="space-y-3">
            <Skeleton className="h-4 w-24 rounded-lg" />
            <Skeleton className="h-10 w-2/3 max-w-md rounded-xl" />
            <Skeleton className="h-4 w-1/2 max-w-sm rounded-lg" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <Skeleton className="h-9 w-32 rounded-xl" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
          <div className="overflow-hidden rounded-2xl border border-divider bg-background">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 border-b border-divider p-4 last:border-0"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Skeleton className="size-4 shrink-0 rounded" />
                  <Skeleton className="h-4 w-40 max-w-full rounded-lg" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className="size-8 rounded-lg" />
                  <Skeleton className="size-8 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <aside className="lg:col-span-1">
          <Card className="glass-panel rounded-3xl p-1">
            <Card.Header className="space-y-2 px-6 pt-6">
              <Skeleton className="h-6 w-36 rounded-lg" />
              <Skeleton className="h-4 w-48 rounded-lg" />
            </Card.Header>
            <Card.Content className="flex flex-col gap-4 px-6 pb-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-4 w-24 rounded-lg" />
                  <Skeleton className="h-10 w-full rounded-xl" />
                </div>
              ))}
            </Card.Content>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export function ProfileDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const profileId = Number(id);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [keyPolicy, setKeyPolicy] = useState<KeyPolicy | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvDragActive, setCsvDragActive] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [externalId, setExternalId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [imageModels, setImageModels] = useState<ProviderModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingImageModels, setLoadingImageModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>(DEFAULT_EXPORT_FIELDS);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const csvInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = !query || product.title.toLowerCase().includes(query);
      if (!matchesSearch) return false;
      if (statusFilter === "all") return true;
      const generated = productHasGeneratedContent(product);
      return statusFilter === "generated" ? generated : !generated;
    });
  }, [products, searchQuery, statusFilter]);

  const allFilteredSelected =
    filteredProducts.length > 0 && filteredProducts.every((product) => selectedIds.includes(product.id));

  function resetCreateForm() {
    setTitle("");
    setExternalId("");
    setShowCreateForm(false);
  }

  function resetImportForm() {
    setCsvFile(null);
    setCsvDragActive(false);
    if (csvInputRef.current) {
      csvInputRef.current.value = "";
    }
    setShowImportForm(false);
  }

  function handleCreateOpenChange(open: boolean) {
    if (open) {
      setShowCreateForm(true);
      setError(null);
      return;
    }
    resetCreateForm();
    setError(null);
  }

  function handleImportOpenChange(open: boolean) {
    if (open) {
      setShowImportForm(true);
      setError(null);
      return;
    }
    resetImportForm();
    setError(null);
  }

  function assignCsvFile(file: File | null) {
    if (!file) {
      setCsvFile(null);
      return;
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && file.type !== "text/csv") {
      setError("Please choose a .csv file.");
      return;
    }
    setError(null);
    setCsvFile(file);
  }

  function clearCsvFile() {
    setCsvFile(null);
    if (csvInputRef.current) {
      csvInputRef.current.value = "";
    }
  }

  function onCsvDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!busy) {
      setCsvDragActive(true);
    }
  }

  function onCsvDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setCsvDragActive(false);
  }

  function onCsvDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setCsvDragActive(false);
    if (busy) return;
    const file = event.dataTransfer.files?.[0] ?? null;
    assignCsvFile(file);
  }

  async function refresh() {
    const [nextProfile, allProducts, nextIntegrations] = await Promise.all([
      getProfile(profileId),
      listProducts(),
      listIntegrations(),
    ]);
    setProfile(nextProfile);
    setIntegrations(nextIntegrations);
    setSelectedModel(nextProfile.model || "");
    setImageModel(nextProfile.image_model || "");
    setPrompt(nextProfile.Prompt);
    setImagePrompt(nextProfile.image_prompt || "");
    try {
      setKeyPolicy((await getMySubscription()).keypolicy);
    } catch {
      setKeyPolicy(null);
    }
    if (
      nextProfile.can_edit &&
      nextProfile.integration &&
      (nextProfile.key_mode === "platform" || nextProfile.has_deepseek_key)
    ) {
      void loadModels(nextProfile.integration, nextProfile.model);
      void loadImageModels(nextProfile.integration, nextProfile.image_model);
    }
    setProducts(allProducts.filter((item) => item.profile === profileId));
    setSelectedIds((current) => {
      const visible = new Set(allProducts.filter((item) => item.profile === profileId).map((item) => item.id));
      return current.filter((itemId) => visible.has(itemId));
    });
  }

  useEffect(() => {
    if (!profileId) {
      return;
    }
    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not open profile");
    });
  }, [profileId]);

  async function onSavePrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateProfile(profileId, { Prompt: prompt, image_prompt: imagePrompt });
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save prompt");
    } finally {
      setBusy(false);
    }
  }

  async function onUpdateKeyMode(nextMode: ProfileKeyMode) {
    setBusy(true);
    setError(null);
    try {
      await updateProfile(profileId, { key_mode: nextMode });
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update key mode");
    } finally {
      setBusy(false);
    }
  }

  async function onUpdateKey(key: string) {
    if (!key.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateProfile(profileId, { DeepSeekApiKey: key.trim() });
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update key");
    } finally {
      setBusy(false);
    }
  }

  async function loadModels(nextIntegrationId: number, currentModel = "") {
    setLoadingModels(true);
    try {
      const data = await listAvailableModels({ integration: nextIntegrationId, profile: profileId });
      setModels(data.models);
      setSelectedModel((current) => {
        const preferred = current || currentModel;
        if (preferred && data.models.some((item) => item.id === preferred)) {
          return preferred;
        }
        return data.models[0]?.id || preferred;
      });
    } catch (err: unknown) {
      setModels([]);
      setError(err instanceof Error ? err.message : "Could not load models");
    } finally {
      setLoadingModels(false);
    }
  }

  async function loadImageModels(nextIntegrationId: number, currentModel = "") {
    setLoadingImageModels(true);
    try {
      const data = await listAvailableModels({ integration: nextIntegrationId, profile: profileId });
      setImageModels(data.models);
      setImageModel((current) => {
        const preferred = current || currentModel;
        if (preferred && data.models.some((item) => item.id === preferred)) {
          return preferred;
        }
        return preferred;
      });
    } catch (err: unknown) {
      setImageModels([]);
      setError(err instanceof Error ? err.message : "Could not load models");
    } finally {
      setLoadingImageModels(false);
    }
  }

  async function onUpdateIntegration(nextId: string) {
    setBusy(true);
    setError(null);
    try {
      await updateProfile(profileId, { integration: Number(nextId) });
      await loadModels(Number(nextId));
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update integration");
    } finally {
      setBusy(false);
    }
  }

  async function onUpdateModel(nextModel: string) {
    setSelectedModel(nextModel);
    setBusy(true);
    setError(null);
    try {
      await updateProfile(profileId, { model: nextModel });
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update model");
    } finally {
      setBusy(false);
    }
  }

  async function onUpdateImageModel(nextModel: string) {
    setImageModel(nextModel);
    setBusy(true);
    setError(null);
    try {
      await updateProfile(profileId, { image_model: nextModel });
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not update image model");
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setImportMessage(null);
    try {
      await createProduct({
        title: title.trim(),
        profile: profileId,
        external_id: externalId.trim(),
      });
      resetCreateForm();
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create product");
    } finally {
      setBusy(false);
    }
  }

  async function onImportCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csvFile) {
      setError("Choose a CSV file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setImportMessage(null);
    try {
      const result = await importProductsFromCsv(profileId, csvFile);
      resetImportForm();
      await refresh();
      const skipped = result.skipped
        ? ` Skipped ${result.skipped} row${result.skipped === 1 ? "" : "s"}.`
        : "";
      if (result.created) {
        setImportMessage(`Imported ${result.created} product${result.created === 1 ? "" : "s"}.${skipped}`);
      } else {
        const firstError = result.errors[0];
        setError(
          firstError
            ? `No products were imported. Row ${firstError.row}: ${firstError.detail}`
            : "No products were imported.",
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not import CSV");
    } finally {
      setBusy(false);
    }
  }

  async function onGenerate(productId: number) {
    setGeneratingId(productId);
    setError(null);
    try {
      await generateProduct(productId);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not generate description");
    } finally {
      setGeneratingId(null);
    }
  }

  async function onDelete(productId: number) {
    setBusy(true);
    setError(null);
    try {
      await deleteProduct(productId);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete product");
    } finally {
      setBusy(false);
    }
  }

  function toggleSelected(productId: number) {
    setSelectedIds((current) =>
      current.includes(productId) ? current.filter((itemId) => itemId !== productId) : [...current, productId],
    );
  }

  function toggleSelectAllFiltered() {
    setSelectedIds((current) => {
      if (allFilteredSelected) {
        const filteredIds = new Set(filteredProducts.map((item) => item.id));
        return current.filter((itemId) => !filteredIds.has(itemId));
      }
      const next = new Set(current);
      for (const product of filteredProducts) {
        next.add(product.id);
      }
      return Array.from(next);
    });
  }

  async function onExport(ids?: number[]) {
    setBusy(true);
    setError(null);
    setImportMessage(null);
    try {
      await exportProductsToCsv(profileId, ids, selectedFields);
      setImportMessage(
        ids?.length
          ? `Exported ${ids.length} selected product${ids.length === 1 ? "" : "s"}.`
          : `Exported all ${products.length} product${products.length === 1 ? "" : "s"}.`,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not export CSV");
    } finally {
      setBusy(false);
    }
  }

  function toggleField(value: string) {
    setSelectedFields((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  function selectAllFields() {
    setSelectedFields(EXPORT_FIELDS.map((field) => field.value));
  }

  function resetFields() {
    setSelectedFields(DEFAULT_EXPORT_FIELDS);
  }

  if (!profile) {
    return error ? <StatusBanner>{error}</StatusBanner> : <ProfileDetailSkeleton />;
  }

  const statusTabs: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "generated", label: "Generated" },
    { value: "empty", label: "Empty" },
  ];

  return (
    <div className={cn("page-stack", selectedIds.length > 0 && "pb-24")}>
      {error ? <StatusBanner>{error}</StatusBanner> : null}
      {importMessage ? <StatusBanner status="success">{importMessage}</StatusBanner> : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                to="/profiles"
                className="text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
              >
                ← Profiles
              </Link>
              <h1 className="mt-3 font-display text-3xl font-semibold md:text-4xl">{profile.title}</h1>
              <p className="mt-2 text-[0.95rem] text-muted">
                {profile.can_edit
                  ? [
                      integrations.find((item) => item.id === profile.integration)?.name,
                      profile.key_mode === "platform"
                        ? "Using platform key."
                        : profile.has_deepseek_key
                          ? "Own API key saved."
                          : "Add your API key in settings.",
                    ]
                      .filter(Boolean)
                      .join(" ")
                  : "Shared profile. View only."}
              </p>
            </div>
            {profile.can_edit ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  variant="outline"
                  onPress={() => {
                    setShowImportForm(true);
                    setError(null);
                  }}
                >
                  Import CSV
                </Button>
                <Button
                  onPress={() => {
                    setShowCreateForm(true);
                    setError(null);
                  }}
                >
                  Create product
                </Button>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            {products.length === 0 ? (
              <p className="text-sm text-muted">
                {profile.can_edit
                  ? "This profile has no products yet. Create one or import a CSV."
                  : "This profile has no products yet."}
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative min-w-0 flex-1">
                    <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                    <Input
                      fullWidth
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Search by title…"
                      className="pl-9"
                      aria-label="Search products by title"
                    />
                  </div>
                  <div
                    className="flex shrink-0 rounded-xl border border-divider bg-background p-1"
                    role="tablist"
                    aria-label="Filter by status"
                  >
                    {statusTabs.map((tab) => (
                      <button
                        key={tab.value}
                        type="button"
                        role="tab"
                        aria-selected={statusFilter === tab.value}
                        className={cn(
                          "rounded-lg px-3 py-1.5 text-sm transition-colors",
                          statusFilter === tab.value
                            ? "bg-foreground text-background"
                            : "text-muted hover:text-foreground",
                        )}
                        onClick={() => setStatusFilter(tab.value)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      className="size-4 accent-foreground"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      disabled={filteredProducts.length === 0}
                    />
                    {selectedIds.length
                      ? `${selectedIds.length} selected`
                      : filteredProducts.length
                        ? "Select all"
                        : "No matches"}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" isDisabled={busy || products.length === 0} onPress={() => void onExport()}>
                      Export all
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      isDisabled={busy}
                      onPress={() => setShowFieldSelector((current) => !current)}
                    >
                      {showFieldSelector ? "Hide fields" : "Select fields"}
                    </Button>
                  </div>
                </div>

                {showFieldSelector ? (
                  <div className="rounded-2xl border border-divider bg-surface-secondary p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">Fields to export</span>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" size="sm" onPress={selectAllFields}>
                          Select all
                        </Button>
                        <Button variant="ghost" size="sm" onPress={resetFields}>
                          Reset
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {EXPORT_FIELDS.map((field) => (
                        <label
                          key={field.value}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-divider bg-background p-2 text-sm transition-colors hover:bg-muted/50"
                        >
                          <input
                            type="checkbox"
                            className="size-4 accent-foreground"
                            checked={selectedFields.includes(field.value)}
                            onChange={() => toggleField(field.value)}
                          />
                          <span className="text-muted">{field.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                {filteredProducts.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-divider px-4 py-8 text-center text-sm text-muted">
                    No products match your search or filter.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-divider bg-background">
                    {filteredProducts.map((product) => {
                      const generated = productHasGeneratedContent(product);
                      return (
                        <div
                          key={product.id}
                          className="flex items-center justify-between gap-3 border-b border-divider p-4 transition-colors last:border-0 hover:bg-muted/30"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <input
                              type="checkbox"
                              className="size-4 shrink-0 accent-foreground"
                              checked={selectedIds.includes(product.id)}
                              onChange={() => toggleSelected(product.id)}
                              aria-label={`Select ${product.title}`}
                            />
                            <div className="min-w-0">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <Link
                                  to={`/profiles/${profileId}/products/${product.id}`}
                                  className="min-w-0"
                                >
                                  <h2 className="truncate text-sm font-medium">{product.title}</h2>
                                </Link>
                                {generated ? (
                                  <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-500">
                                    Generated
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-xs text-orange-500">
                                    Empty
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Open ${product.title}`}
                              onPress={() => navigate(`/profiles/${profileId}/products/${product.id}`)}
                            >
                              <IconEye className="size-4" />
                            </Button>
                            {profile.can_edit ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`Generate ${product.title}`}
                                  isDisabled={generatingId === product.id || busy}
                                  onPress={() => void onGenerate(product.id)}
                                >
                                  {generatingId === product.id ? (
                                    <IconLoader2 className="size-4 animate-spin" />
                                  ) : (
                                    <IconCpu className="size-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`Delete ${product.title}`}
                                  className="hover:bg-danger/10 hover:text-danger"
                                  isDisabled={busy}
                                  onPress={() => void onDelete(product.id)}
                                >
                                  <IconTrash className="size-4" />
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <aside className="lg:col-span-1">
          {profile.can_edit ? (
            <Card className="glass-panel sticky top-6 rounded-3xl p-1">
              <Card.Header className="px-6 pt-6">
                <Card.Title>Profile settings</Card.Title>
                <Card.Description>Integration, models, key source, and prompts.</Card.Description>
              </Card.Header>
              <Card.Content className="px-6 pb-6">
                <form className="flex flex-col gap-5" onSubmit={onSavePrompt}>
                  <div className="space-y-2.5">
                    <Label htmlFor="profile-integration">Integration</Label>
                    <NativeSelect
                      id="profile-integration"
                      value={profile.integration ? String(profile.integration) : ""}
                      disabled={busy}
                      onChange={(event) => void onUpdateIntegration(event.target.value)}
                    >
                      <option value="" disabled>
                        Select an integration
                      </option>
                      {integrations.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="profile-model">Model</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        isDisabled={loadingModels || busy || !profile.integration}
                        onPress={() => profile.integration && void loadModels(profile.integration, selectedModel)}
                      >
                        {loadingModels ? "Loading…" : "Load models"}
                      </Button>
                    </div>
                    {models.length ? (
                      <NativeSelect
                        id="profile-model"
                        value={selectedModel}
                        disabled={busy}
                        onChange={(event) => void onUpdateModel(event.target.value)}
                      >
                        {models.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name === item.id ? item.id : `${item.name} (${item.id})`}
                          </option>
                        ))}
                      </NativeSelect>
                    ) : (
                      <Input
                        id="profile-model"
                        fullWidth
                        value={selectedModel}
                        disabled={busy}
                        onBlur={(event) => {
                          if (event.target.value.trim() && event.target.value !== profile.model) {
                            void onUpdateModel(event.target.value.trim());
                          }
                        }}
                        onChange={(event) => setSelectedModel(event.target.value)}
                        placeholder="Load models or type an id"
                      />
                    )}
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="profile-image-model">Image model</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        isDisabled={loadingImageModels || busy || !profile.integration}
                        onPress={() =>
                          profile.integration && void loadImageModels(profile.integration, imageModel)
                        }
                      >
                        {loadingImageModels ? "Loading…" : "Load models"}
                      </Button>
                    </div>
                    {imageModels.length ? (
                      <NativeSelect
                        id="profile-image-model"
                        value={imageModel}
                        disabled={busy}
                        onChange={(event) => void onUpdateImageModel(event.target.value)}
                      >
                        <option value="">No image model</option>
                        {integrations
                          .find((item) => item.id === profile.integration)
                          ?.api_url?.includes("openrouter.ai") ? (
                          <>
                            <option value="openrouter/auto-beta">openrouter/auto-beta (auto router)</option>
                            <option value="openrouter/auto">openrouter/auto (legacy auto)</option>
                          </>
                        ) : null}
                        {imageModels.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name === item.id ? item.id : `${item.name} (${item.id})`}
                          </option>
                        ))}
                      </NativeSelect>
                    ) : (
                      <Input
                        id="profile-image-model"
                        fullWidth
                        value={imageModel}
                        disabled={busy}
                        onBlur={(event) => {
                          if (event.target.value.trim() !== (profile.image_model || "")) {
                            void onUpdateImageModel(event.target.value.trim());
                          }
                        }}
                        onChange={(event) => setImageModel(event.target.value)}
                        placeholder="e.g. openrouter/auto-beta or google/gemini-2.5-flash-image"
                      />
                    )}
                    <FieldHint>
                      Used for product photo generation. On OpenRouter you can pick openrouter/auto-beta to let
                      OpenRouter choose an image model. Only available on plans that include image generation.
                    </FieldHint>
                  </div>
                  <div className="space-y-2.5">
                    <Label htmlFor="profile-key-mode">API key source</Label>
                    {allowedKeyModes(keyPolicy).length > 1 ? (
                      <NativeSelect
                        id="profile-key-mode"
                        value={profile.key_mode}
                        disabled={busy}
                        onChange={(event) => void onUpdateKeyMode(event.target.value as ProfileKeyMode)}
                      >
                        {allowedKeyModes(keyPolicy).includes("platform") ? (
                          <option value="platform">Use platform key (from integration)</option>
                        ) : null}
                        {allowedKeyModes(keyPolicy).includes("byok") ? (
                          <option value="byok">Use my own API key</option>
                        ) : null}
                      </NativeSelect>
                    ) : (
                      <p className="text-sm text-muted">
                        {profile.key_mode === "byok"
                          ? "Your plan requires your own API key."
                          : "Your plan uses the platform key from the integration."}
                      </p>
                    )}
                  </div>
                  {profile.key_mode === "byok" ? (
                    <div className="space-y-2.5">
                      <Label htmlFor="new-key">New API key</Label>
                      <Input
                        id="new-key"
                        type="password"
                        fullWidth
                        placeholder="Paste the key and click outside the field"
                        disabled={busy}
                        onBlur={(event) => {
                          const value = event.target.value;
                          event.target.value = "";
                          void onUpdateKey(value);
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted">
                      This profile uses the built-in key from the selected integration.
                    </p>
                  )}

                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-divider bg-background px-3 py-2 text-left text-sm"
                    aria-expanded={settingsExpanded}
                    onClick={() => setSettingsExpanded((current) => !current)}
                  >
                    <span className="font-medium">Prompts</span>
                    <IconChevronDown
                      className={cn("size-4 text-muted transition-transform duration-200", {
                        "rotate-180": settingsExpanded,
                      })}
                    />
                  </button>

                  {settingsExpanded ? (
                    <>
                      <div className="space-y-2.5">
                        <Label htmlFor="profile-prompt">Text prompt</Label>
                        <TextArea
                          id="profile-prompt"
                          fullWidth
                          rows={3}
                          value={prompt}
                          onChange={(event) => setPrompt(event.target.value)}
                        />
                        <FieldHint>Used for product description generation.</FieldHint>
                      </div>
                      <div className="space-y-2.5">
                        <Label htmlFor="profile-image-prompt">Image prompt</Label>
                        <TextArea
                          id="profile-image-prompt"
                          fullWidth
                          rows={3}
                          value={imagePrompt}
                          onChange={(event) => setImagePrompt(event.target.value)}
                          placeholder="Optional. Placeholders: {title}, {description}, {short_description}, {product_type}, {tags}"
                        />
                        <FieldHint>
                          Used with an uploaded product photo as reference. Leave blank for the default studio
                          style.
                        </FieldHint>
                      </div>
                      <Button variant="outline" type="submit" className="w-fit" isDisabled={busy} isPending={busy}>
                        Save prompts
                      </Button>
                    </>
                  ) : null}
                </form>
              </Card.Content>
            </Card>
          ) : profile.Prompt ? (
            <Card className="glass-panel sticky top-6 rounded-3xl p-1">
              <Card.Header className="flex items-start justify-between gap-3 px-6 pt-6">
                <Card.Title>Prompt</Card.Title>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    void navigator.clipboard.writeText(profile.Prompt);
                  }}
                >
                  Copy
                </Button>
              </Card.Header>
              <Card.Content className="px-6 pb-6">
                <p className="whitespace-pre-wrap text-[0.95rem] leading-7 text-muted">{profile.Prompt}</p>
              </Card.Content>
            </Card>
          ) : null}
        </aside>
      </div>

      {profile.can_edit ? (
        <>
          <Modal.Backdrop isOpen={showCreateForm} onOpenChange={handleCreateOpenChange}>
            <Modal.Container size="md" scroll="inside" placement="center">
              <Modal.Dialog className="glass-panel">
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>New product</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form className="flex flex-col gap-5" onSubmit={onCreate}>
                    <div className="space-y-2.5">
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        fullWidth
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        required
                        disabled={busy}
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label htmlFor="external">Store ID</Label>
                      <Input
                        id="external"
                        fullWidth
                        value={externalId}
                        onChange={(event) => setExternalId(event.target.value)}
                        disabled={busy}
                      />
                      <FieldHint>Used later to export the product back to the store</FieldHint>
                    </div>
                    <div className="flex flex-wrap gap-2 pb-2">
                      <Button type="submit" isDisabled={busy || !title.trim()} isPending={busy}>
                        Add product
                      </Button>
                      <Button
                        variant="outline"
                        type="button"
                        isDisabled={busy}
                        onPress={() => handleCreateOpenChange(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>

          <Modal.Backdrop isOpen={showImportForm} onOpenChange={handleImportOpenChange}>
            <Modal.Container size="lg" scroll="inside" placement="center">
              <Modal.Dialog className="glass-panel">
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Heading>Import products from CSV</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <form className="flex flex-col gap-5" onSubmit={onImportCsv}>
                    <div className="space-y-2.5">
                      <Label htmlFor="csv-file">CSV file</Label>
                      <input
                        id="csv-file"
                        ref={csvInputRef}
                        className="hidden"
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(event) => assignCsvFile(event.target.files?.[0] ?? null)}
                      />
                      {csvFile ? (
                        <div className="flex items-center gap-3 rounded-2xl border border-divider bg-background px-4 py-3">
                          <IconFileSpreadsheet className="size-5 shrink-0 text-[var(--accent)]" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{csvFile.name}</p>
                            <p className="text-xs text-muted">{(csvFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            isDisabled={busy}
                            aria-label="Remove file"
                            onPress={clearCsvFile}
                          >
                            <IconX className="size-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            type="button"
                            isDisabled={busy}
                            onPress={() => csvInputRef.current?.click()}
                          >
                            Change
                          </Button>
                        </div>
                      ) : (
                        <div
                          role="button"
                          tabIndex={0}
                          className={cn(
                            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-10 text-center transition-colors",
                            csvDragActive
                              ? "border-[var(--accent)] bg-[var(--accent)]/5"
                              : "border-divider bg-surface-secondary hover:border-foreground/30",
                            busy && "pointer-events-none opacity-60",
                          )}
                          onClick={() => !busy && csvInputRef.current?.click()}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              csvInputRef.current?.click();
                            }
                          }}
                          onDragOver={onCsvDragOver}
                          onDragLeave={onCsvDragLeave}
                          onDrop={onCsvDrop}
                        >
                          <IconUpload className="size-8 text-muted" />
                          <p className="text-sm font-medium">
                            {csvDragActive ? "Drop CSV here" : "Drag & drop a CSV file"}
                          </p>
                          <p className="text-xs text-muted">or click to browse</p>
                        </div>
                      )}
                      <FieldHint>
                        Required column: title (or name). Optional: external_id, barcode, group_id, product_type,
                        tags, short_description, description, meta_title, meta_description, bullet_points,
                        google_product_category, google_product_category_path. Comma or semicolon separators are
                        supported. Bullet points can use | separators.
                      </FieldHint>
                    </div>
                    <div className="flex flex-wrap gap-2 pb-2">
                      <Button type="submit" isDisabled={busy || !csvFile} isPending={busy}>
                        Import products
                      </Button>
                      <Button
                        variant="outline"
                        type="button"
                        isDisabled={busy}
                        onPress={() => handleImportOpenChange(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex w-full max-w-xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-divider bg-background/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <p className="text-sm font-medium">
              {selectedIds.length} selected
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                isDisabled={busy}
                isPending={busy}
                onPress={() => void onExport(selectedIds)}
              >
                Export selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                isDisabled={busy}
                onPress={() => setSelectedIds([])}
              >
                Clear selection
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
