import { type FormEvent, useEffect, useState } from "react";
import { Button, Card, Chip, Input, Label } from "@heroui/react";
import { Navigate } from "react-router-dom";

import {
  createIntegration,
  deleteIntegration,
  listAvailableModels,
  listIntegrations,
  updateIntegration,
  type Integration,
  type ProviderModel,
} from "./api";
import { useAuth } from "./auth";
import { FieldHint } from "@/components/field-hint";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { StatusBanner } from "@/components/status-banner";

export function IntegrationsPage() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isPlatformDefault, setIsPlatformDefault] = useState(false);
  const [model, setModel] = useState("");
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetForm() {
    setName("");
    setApiUrl("");
    setApiKey("");
    setIsPlatformDefault(false);
    setModel("");
    setModels([]);
    setShowForm(false);
    setEditingId(null);
  }

  async function refresh() {
    setIntegrations(await listIntegrations());
  }

  useEffect(() => {
    if (!user?.is_staff) {
      return;
    }
    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load integrations");
    });
  }, [user?.is_staff]);

  if (!user) {
    return <p className="text-sm text-muted">Loading…</p>;
  }
  if (!user.is_staff) {
    return <Navigate to="/profiles" replace />;
  }

  async function onLoadModels() {
    if (!apiUrl.trim()) {
      setError("Enter an API URL first");
      return;
    }
    setLoadingModels(true);
    setError(null);
    try {
      const data = await listAvailableModels({
        api_url: apiUrl.trim(),
        api_key: apiKey.trim() || undefined,
        integration: editingId || undefined,
      });
      setModels(data.models);
      setModel((current) => {
        if (current && data.models.some((item) => item.id === current)) {
          return current;
        }
        return data.models[0]?.id || "";
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load models");
    } finally {
      setLoadingModels(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        api_url: apiUrl.trim(),
        model: model.trim(),
        is_platform_default: isPlatformDefault,
        ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
      };
      if (editingId) {
        await updateIntegration(editingId, payload);
      } else {
        await createIntegration(payload);
      }
      resetForm();
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save integration");
    } finally {
      setBusy(false);
    }
  }

  function onEdit(integration: Integration) {
    setEditingId(integration.id);
    setName(integration.name);
    setApiUrl(integration.api_url);
    setApiKey("");
    setIsPlatformDefault(integration.is_platform_default);
    setModel(integration.model);
    setModels(integration.model ? [{ id: integration.model, name: integration.model }] : []);
    setShowForm(true);
    setError(null);
  }

  async function onDelete(id: number) {
    setBusy(true);
    setError(null);
    try {
      await deleteIntegration(id);
      if (editingId === id) {
        resetForm();
      }
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete integration");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Integrations"
        description="Admin integrations with optional built-in keys for platform profiles."
        action={
          !showForm ? (
            <Button className="shrink-0" onPress={() => setShowForm(true)}>
              Create integration
            </Button>
          ) : null
        }
      />
      {error ? <StatusBanner>{error}</StatusBanner> : null}

      {showForm ? (
        <Card className="glass-panel fade-in rounded-3xl p-1">
          <Card.Header className="px-6 pt-6">
            <Card.Title>{editingId ? "Edit integration" : "New integration"}</Card.Title>
          </Card.Header>
          <Card.Content className="px-6 pb-6">
            <form className="flex flex-col gap-5" onSubmit={onSubmit}>
              <div className="space-y-2.5">
                <Label htmlFor="integration-name">API name</Label>
                <Input
                  id="integration-name"
                  fullWidth
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="integration-url">API URL</Label>
                <Input
                  id="integration-url"
                  type="url"
                  fullWidth
                  value={apiUrl}
                  onChange={(event) => setApiUrl(event.target.value)}
                  placeholder="https://openrouter.ai/api/v1"
                  required
                />
                <FieldHint>OpenAI-compatible base URL. Models are loaded from /models.</FieldHint>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="integration-api-key">Built-in API key</Label>
                <Input
                  id="integration-api-key"
                  type="password"
                  fullWidth
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={editingId ? "Leave blank to keep current key" : "Platform key for this provider"}
                />
                <FieldHint>
                  Stored on the integration. Profiles in “platform key” mode will use it. Never shown again.
                </FieldHint>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-foreground"
                  checked={isPlatformDefault}
                  onChange={(event) => setIsPlatformDefault(event.target.checked)}
                />
                Set as default platform integration
              </label>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="integration-model">Default model</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    isDisabled={loadingModels || busy}
                    onPress={() => void onLoadModels()}
                  >
                    {loadingModels ? "Loading…" : "Load models"}
                  </Button>
                </div>
                {models.length ? (
                  <NativeSelect
                    id="integration-model"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                  >
                    {models.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name === item.id ? item.id : `${item.name} (${item.id})`}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input
                    id="integration-model"
                    fullWidth
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder="Load models or type an id"
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" isDisabled={busy} isPending={busy}>
                  {editingId ? "Save integration" : "Add integration"}
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
        {integrations.length === 0 ? (
          <p className="text-sm text-muted">No integrations yet. Click “Create integration”.</p>
        ) : (
          integrations.map((integration, index) => (
            <Card
              key={integration.id}
              className="lift-card glass-panel fade-in rounded-3xl p-1"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <Card.Content className="list-row items-start gap-4 px-6 py-5">
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-semibold">{integration.name}</h2>
                  <p className="mt-1.5 break-all text-sm text-muted">{integration.api_url}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {integration.model ? (
                      <Chip size="sm" variant="soft" color="accent">
                        {integration.model}
                      </Chip>
                    ) : null}
                    <Chip size="sm" color={integration.is_active ? "success" : "default"} variant="soft">
                      {integration.is_active ? "Active" : "Inactive"}
                    </Chip>
                    <Chip size="sm" color={integration.has_api_key ? "success" : "default"} variant="soft">
                      {integration.has_api_key ? "Built-in key" : "No built-in key"}
                    </Chip>
                    {integration.is_platform_default ? (
                      <Chip size="sm" variant="soft" color="accent">
                        Default
                      </Chip>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <Button variant="outline" size="sm" isDisabled={busy} onPress={() => onEdit(integration)}>
                    Edit
                  </Button>
                  <Button
                    variant="danger-soft"
                    size="sm"
                    isDisabled={busy}
                    onPress={() => void onDelete(integration.id)}
                  >
                    Delete
                  </Button>
                </div>
              </Card.Content>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
