import { IconLoader2 } from "@tabler/icons-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  createProduct,
  deleteProduct,
  exportProductsToCsv,
  generateProduct,
  getProfile,
  importProductsFromCsv,
  listAvailableModels,
  listIntegrations,
  listProducts,
  updateProfile,
  type Integration,
  type Product,
  type Profile,
  type ProviderModel,
} from "./api";
import { FieldHint } from "@/components/field-hint";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";

export function ProfileDetailPage() {
  const { id } = useParams();
  const profileId = Number(id);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [externalId, setExternalId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const csvInputRef = useRef<HTMLInputElement>(null);

  function resetCreateForm() {
    setTitle("");
    setExternalId("");
    setShowCreateForm(false);
  }

  function resetImportForm() {
    setCsvFile(null);
    if (csvInputRef.current) {
      csvInputRef.current.value = "";
    }
    setShowImportForm(false);
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
    setPrompt(nextProfile.Prompt);
    if (nextProfile.can_edit && nextProfile.integration && nextProfile.has_deepseek_key) {
      void loadModels(nextProfile.integration, nextProfile.model);
    }
    setProducts(allProducts.filter((item) => item.profile === profileId));
    setSelectedIds((current) => {
      const visible = new Set(allProducts.filter((item) => item.profile === profileId).map((item) => item.id));
      return current.filter((id) => visible.has(id));
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
      await updateProfile(profileId, { Prompt: prompt });
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save prompt");
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
      current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId],
    );
  }

  function toggleSelectAll() {
    setSelectedIds((current) => (current.length === products.length ? [] : products.map((item) => item.id)));
  }

  async function onExport(ids?: number[]) {
    setBusy(true);
    setError(null);
    setImportMessage(null);
    try {
      await exportProductsToCsv(profileId, ids);
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

  if (!profile) {
    return error ? (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    ) : (
      <p className="text-sm text-muted-foreground">Loading…</p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to="/profiles" className="text-sm text-primary underline-offset-4 hover:underline">
            ← Profiles
          </Link>
          <h1 className="mt-2 font-heading text-2xl font-medium tracking-tight">{profile.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.can_edit
              ? [
                  integrations.find((item) => item.id === profile.integration)?.name,
                  profile.has_deepseek_key ? "API key saved." : "Add a key in settings.",
                ]
                  .filter(Boolean)
                  .join(" ")
              : "Shared profile. View only."}
          </p>
        </div>
        {profile.can_edit && !showCreateForm && !showImportForm ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowImportForm(true);
                setError(null);
              }}
            >
              Import CSV
            </Button>
            <Button onClick={() => setShowCreateForm(true)}>Create product</Button>
          </div>
        ) : null}
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {importMessage ? (
        <Alert>
          <AlertDescription>{importMessage}</AlertDescription>
        </Alert>
      ) : null}

      {profile.can_edit && showCreateForm ? (
        <Card>
          <CardHeader>
            <CardTitle>New product</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={onCreate}>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="external">Store ID</Label>
                <Input id="external" value={externalId} onChange={(event) => setExternalId(event.target.value)} />
                <FieldHint>Used later to export the product back to the store</FieldHint>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>
                  Add product
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    resetCreateForm();
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

      {profile.can_edit && showImportForm ? (
        <Card>
          <CardHeader>
            <CardTitle>Import products from CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={onImportCsv}>
              <div className="space-y-2">
                <Label htmlFor="csv-file">CSV file</Label>
                <input
                  id="csv-file"
                  ref={csvInputRef}
                  className="hidden"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)}
                />
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    type="button"
                    disabled={busy}
                    onClick={() => csvInputRef.current?.click()}
                  >
                    Choose file
                  </Button>
                  <span className={cn("truncate text-sm", csvFile ? "text-foreground" : "text-muted-foreground")}>
                    {csvFile ? csvFile.name : "No file selected"}
                  </span>
                </div>
                <FieldHint>
                  Required column: title (or name). Optional: external_id, barcode, group_id, description,
                  google_product_category. Comma or semicolon separators are supported.
                </FieldHint>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy || !csvFile}>
                  Import products
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    resetImportForm();
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
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {profile.can_edit
              ? "This profile has no products yet. Create one or import a CSV."
              : "This profile has no products yet."}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-foreground"
                  checked={selectedIds.length === products.length}
                  onChange={toggleSelectAll}
                />
                {selectedIds.length ? `${selectedIds.length} selected` : "Select all"}
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || selectedIds.length === 0}
                  onClick={() => void onExport(selectedIds)}
                >
                  Export selected
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void onExport()}>
                  Export all
                </Button>
              </div>
            </div>
            {products.map((product) => (
              <Card key={product.id} size="sm">
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-foreground"
                      checked={selectedIds.includes(product.id)}
                      onChange={() => toggleSelected(product.id)}
                      aria-label={`Select ${product.title}`}
                    />
                    <Link to={`/profiles/${profileId}/products/${product.id}`} className="min-w-0">
                      <h2 className="font-medium">{product.title}</h2>
                    </Link>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      className={cn(buttonVariants({ size: "sm" }))}
                      to={`/profiles/${profileId}/products/${product.id}`}
                    >
                      Open
                    </Link>
                    {profile.can_edit ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={generatingId === product.id}
                          onClick={() => void onGenerate(product.id)}
                        >
                          {generatingId === product.id ? <IconLoader2 className="animate-spin" /> : "Generate"}
                        </Button>
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => void onDelete(product.id)}>
                          Delete
                        </Button>
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>

      {!profile.can_edit && profile.Prompt ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle>Prompt</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(profile.Prompt);
                }}
              >
                Copy
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{profile.Prompt}</p>
          </CardContent>
        </Card>
      ) : null}

      {profile.can_edit ? (
        <Accordion>
          <AccordionItem value="settings">
            <AccordionTrigger>Profile settings</AccordionTrigger>
            <AccordionContent>
              <form className="flex flex-col gap-4" onSubmit={onSavePrompt}>
                <div className="space-y-2">
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="profile-model">Model</Label>
                    <Button
                      variant="outline"
                      size="xs"
                      type="button"
                      disabled={loadingModels || busy || !profile.integration}
                      onClick={() => profile.integration && void loadModels(profile.integration, selectedModel)}
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
                <div className="space-y-2">
                  <Label htmlFor="new-key">New API key</Label>
                  <Input
                    id="new-key"
                    type="password"
                    placeholder="Paste the key and click outside the field"
                    disabled={busy}
                    onBlur={(event) => {
                      const value = event.target.value;
                      event.target.value = "";
                      void onUpdateKey(value);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-prompt">Prompt</Label>
                  <Textarea
                    id="profile-prompt"
                    rows={3}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                  />
                </div>
                <Button variant="outline" type="submit" className="w-fit" disabled={busy}>
                  Save prompt
                </Button>
              </form>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </div>
  );
}
