import { type FormEvent, useEffect, useState } from "react";
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
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export function IntegrationsPage() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [fetchKey, setFetchKey] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetForm() {
    setName("");
    setApiUrl("");
    setFetchKey("");
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
    return <p className="text-sm text-muted-foreground">Loading…</p>;
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
        api_key: fetchKey.trim() || undefined,
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
      const payload = { name: name.trim(), api_url: apiUrl.trim(), model: model.trim() };
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
    setFetchKey("");
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integrations"
        description="Add an API name and URL, then load models from the provider."
        action={
          !showForm ? (
            <Button className="shrink-0" onClick={() => setShowForm(true)}>
              Create integration
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
            <CardTitle>{editingId ? "Edit integration" : "New integration"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="integration-name">API name</Label>
                <Input
                  id="integration-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="integration-url">API URL</Label>
                <Input
                  id="integration-url"
                  type="url"
                  value={apiUrl}
                  onChange={(event) => setApiUrl(event.target.value)}
                  placeholder="https://openrouter.ai/api/v1"
                  required
                />
                <FieldHint>OpenAI-compatible base URL. Models are loaded from /models.</FieldHint>
              </div>
              <div className="space-y-2">
                <Label htmlFor="integration-fetch-key">Key to load models (optional)</Label>
                <Input
                  id="integration-fetch-key"
                  type="password"
                  value={fetchKey}
                  onChange={(event) => setFetchKey(event.target.value)}
                />
                <FieldHint>Needed for OpenAI or DeepSeek. OpenRouter usually works without it.</FieldHint>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="integration-model">Default model</Label>
                  <Button
                    variant="outline"
                    size="xs"
                    type="button"
                    disabled={loadingModels || busy}
                    onClick={() => void onLoadModels()}
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
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder="Load models or type an id"
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>
                  {editingId ? "Save integration" : "Add integration"}
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
        {integrations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No integrations yet. Click “Create integration”.</p>
        ) : (
          integrations.map((integration) => (
            <Card key={integration.id} size="sm">
              <CardContent className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-medium">{integration.name}</h2>
                  <p className="mt-1 break-all text-sm text-muted-foreground">{integration.api_url}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {integration.model ? <Badge variant="secondary">{integration.model}</Badge> : null}
                    <Badge variant={integration.is_active ? "default" : "outline"}>
                      {integration.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => onEdit(integration)}>
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void onDelete(integration.id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
