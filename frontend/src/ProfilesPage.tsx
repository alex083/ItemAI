import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  createProfile,
  deleteProfile,
  listAvailableModels,
  listIntegrations,
  listProfiles,
  type Integration,
  type Profile,
  type ProviderModel,
} from "./api";
import { FieldHint } from "@/components/field-hint";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState("");
  const [integrationId, setIntegrationId] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetCreateForm() {
    setTitle("");
    setIntegrationId(integrations[0] ? String(integrations[0].id) : "");
    setModel("");
    setModels([]);
    setApiKey("");
    setPrompt("");
    setShowCreateForm(false);
  }

  async function loadModels(nextIntegrationId: string, key: string) {
    if (!nextIntegrationId) {
      setModels([]);
      setModel("");
      return;
    }
    setLoadingModels(true);
    try {
      const data = await listAvailableModels({
        integration: Number(nextIntegrationId),
        api_key: key.trim() || undefined,
      });
      setModels(data.models);
      const fallback = integrations.find((item) => String(item.id) === nextIntegrationId)?.model || "";
      setModel((current) => {
        if (current && data.models.some((item) => item.id === current)) {
          return current;
        }
        if (fallback && data.models.some((item) => item.id === fallback)) {
          return fallback;
        }
        return data.models[0]?.id || fallback;
      });
    } catch (err: unknown) {
      setModels([]);
      setError(err instanceof Error ? err.message : "Could not load models");
    } finally {
      setLoadingModels(false);
    }
  }

  async function refresh() {
    const [nextProfiles, nextIntegrations] = await Promise.all([listProfiles(), listIntegrations()]);
    setProfiles(nextProfiles);
    setIntegrations(nextIntegrations);
    setIntegrationId((current) => current || (nextIntegrations[0] ? String(nextIntegrations[0].id) : ""));
  }

  useEffect(() => {
    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load profiles");
    });
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createProfile({
        title: title.trim(),
        integration: Number(integrationId),
        model: model.trim(),
        DeepSeekApiKey: apiKey.trim(),
        Prompt: prompt.trim(),
      });
      resetCreateForm();
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create profile");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    setBusy(true);
    setError(null);
    try {
      await deleteProfile(id);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Profiles"
        description="Open a profile to add products."
        action={
          !showCreateForm ? (
            <Button
              className="shrink-0"
              onClick={() => {
                setShowCreateForm(true);
                if (integrationId) {
                  void loadModels(integrationId, apiKey);
                }
              }}
            >
              Create profile
            </Button>
          ) : null
        }
      />
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {showCreateForm ? (
        <Card>
          <CardHeader>
            <CardTitle>New profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={onCreate}>
              <div className="space-y-2">
                <Label htmlFor="shop">Shop name</Label>
                <Input id="shop" value={title} onChange={(event) => setTitle(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="integration">Integration</Label>
                <NativeSelect
                  id="integration"
                  value={integrationId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setIntegrationId(nextId);
                    void loadModels(nextId, apiKey);
                  }}
                  required
                >
                  {integrations.length === 0 ? <option value="">No integrations yet</option> : null}
                  {integrations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </NativeSelect>
                <FieldHint>Ask an admin to add an integration if the list is empty.</FieldHint>
              </div>
              <div className="space-y-2">
                <Label htmlFor="key">API key</Label>
                <Input
                  id="key"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  onBlur={() => {
                    if (integrationId) {
                      void loadModels(integrationId, apiKey);
                    }
                  }}
                  required
                />
                <FieldHint>The key is stored on the profile and will not be shown again.</FieldHint>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="profile-model">Model</Label>
                  <Button
                    variant="outline"
                    size="xs"
                    type="button"
                    disabled={loadingModels || busy || !integrationId}
                    onClick={() => void loadModels(integrationId, apiKey)}
                  >
                    {loadingModels ? "Loading…" : "Load models"}
                  </Button>
                </div>
                {models.length ? (
                  <NativeSelect
                    id="profile-model"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    required
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
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder="Load models or type an id"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="prompt">Custom prompt (optional)</Label>
                <Textarea id="prompt" rows={3} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>
                  Add profile
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

      <div className="flex flex-col gap-3">
        {profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No profiles yet. Click “Create profile”.</p>
        ) : (
          profiles.map((profile) => (
            <Card key={profile.id} size="sm">
              <CardContent className="flex items-center justify-between gap-3">
                <Link to={`/profiles/${profile.id}`} className="min-w-0">
                  <h2 className="font-medium">{profile.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profile.model || integrations.find((item) => item.id === profile.integration)?.model ? (
                      <Badge variant="secondary">
                        {profile.model ||
                          integrations.find((item) => item.id === profile.integration)?.model ||
                          "Model selected"}
                      </Badge>
                    ) : profile.integration ? (
                      <Badge variant="secondary">
                        {integrations.find((item) => item.id === profile.integration)?.name || "Integration"}
                      </Badge>
                    ) : null}
                    <Badge variant={profile.has_deepseek_key ? "default" : "outline"}>
                      {profile.has_deepseek_key ? "Key saved" : "No key"}
                    </Badge>
                    {profile.can_edit ? null : <Badge variant="outline">View only</Badge>}
                  </div>
                </Link>
                {profile.can_edit ? (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => onDelete(profile.id)}>
                    Delete
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
