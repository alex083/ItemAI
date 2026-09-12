import { type FormEvent, useEffect, useState } from "react";
import { Button, Card, Chip, Input, Label, TextArea } from "@heroui/react";
import { Link } from "react-router-dom";

import {
  createProfile,
  defaultKeyMode,
  deleteProfile,
  getMySubscription,
  listAvailableModels,
  listIntegrations,
  listProfiles,
  type Integration,
  type KeyPolicy,
  allowedKeyModes,
  type Profile,
  type ProfileKeyMode,
  type ProviderModel,
} from "./api";
import { FieldHint } from "@/components/field-hint";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { StatusBanner } from "@/components/status-banner";

function pickDefaultIntegration(items: Integration[]) {
  const preferred = items.find((item) => item.is_platform_default && item.has_api_key)
    || items.find((item) => item.has_api_key)
    || items[0];
  return preferred ? String(preferred.id) : "";
}

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [keyPolicy, setKeyPolicy] = useState<KeyPolicy | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState("");
  const [integrationId, setIntegrationId] = useState("");
  const [keyMode, setKeyMode] = useState<ProfileKeyMode>("platform");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const keyModeOptions = allowedKeyModes(keyPolicy);

  function resetCreateForm() {
    setTitle("");
    setIntegrationId(pickDefaultIntegration(integrations));
    setKeyMode(defaultKeyMode(keyPolicy));
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
    setIntegrationId((current) => current || pickDefaultIntegration(nextIntegrations));

    let policy: KeyPolicy | null = null;
    try {
      const subscription = await getMySubscription();
      policy = subscription.keypolicy;
    } catch {
      policy = null;
    }
    setKeyPolicy(policy);
    setKeyMode((current) => {
      const allowed = allowedKeyModes(policy);
      return allowed.includes(current) ? current : defaultKeyMode(policy);
    });
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
        key_mode: keyMode,
        model: model.trim(),
        DeepSeekApiKey: keyMode === "byok" ? apiKey.trim() : "",
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
    <div className="page-stack">
      <PageHeader
        title="Profiles"
        description="Open a profile to add products."
        action={
          !showCreateForm ? (
            <Button
              className="shrink-0"
              onPress={() => {
                setShowCreateForm(true);
                if (integrationId) {
                  void loadModels(integrationId, keyMode === "byok" ? apiKey : "");
                }
              }}
            >
              Create profile
            </Button>
          ) : null
        }
      />
      {error ? <StatusBanner>{error}</StatusBanner> : null}

      {showCreateForm ? (
        <Card className="glass-panel fade-in rounded-3xl p-1">
          <Card.Header className="px-6 pt-6">
            <Card.Title>New profile</Card.Title>
          </Card.Header>
          <Card.Content className="px-6 pb-6">
            <form className="flex flex-col gap-5" onSubmit={onCreate}>
              <div className="space-y-2.5">
                <Label htmlFor="shop">Shop name</Label>
                <Input id="shop" fullWidth value={title} onChange={(event) => setTitle(event.target.value)} required />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="integration">Integration</Label>
                <NativeSelect
                  id="integration"
                  value={integrationId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setIntegrationId(nextId);
                    void loadModels(nextId, keyMode === "byok" ? apiKey : "");
                  }}
                  required
                >
                  {integrations.length === 0 ? <option value="">No integrations yet</option> : null}
                  {integrations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {item.has_api_key ? " · platform key" : ""}
                      {item.is_platform_default ? " · default" : ""}
                    </option>
                  ))}
                </NativeSelect>
                <FieldHint>Ask an admin to add an integration if the list is empty.</FieldHint>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="key-mode">API key source</Label>
                {keyModeOptions.length > 1 ? (
                  <NativeSelect
                    id="key-mode"
                    value={keyMode}
                    onChange={(event) => {
                      const next = event.target.value as ProfileKeyMode;
                      setKeyMode(next);
                      if (integrationId) {
                        void loadModels(integrationId, next === "byok" ? apiKey : "");
                      }
                    }}
                  >
                    {keyModeOptions.includes("platform") ? (
                      <option value="platform">Use platform key (from integration)</option>
                    ) : null}
                    {keyModeOptions.includes("byok") ? (
                      <option value="byok">Use my own API key</option>
                    ) : null}
                  </NativeSelect>
                ) : (
                  <p className="text-sm text-muted">
                    {keyMode === "byok"
                      ? "Your plan requires your own API key."
                      : "Your plan uses the platform key from the integration."}
                  </p>
                )}
                {keyPolicy === "hybrid" ? (
                  <FieldHint>
                    Platform key works only for integrations where an admin saved a built-in key.
                  </FieldHint>
                ) : null}
              </div>
              {keyMode === "byok" ? (
                <div className="space-y-2.5">
                  <Label htmlFor="key">API key</Label>
                  <Input
                    id="key"
                    type="password"
                    fullWidth
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
              ) : null}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="profile-model">Model</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    isDisabled={loadingModels || busy || !integrationId}
                    onPress={() => void loadModels(integrationId, keyMode === "byok" ? apiKey : "")}
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
                    fullWidth
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder="Load models or type an id"
                  />
                )}
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="prompt">Custom prompt (optional)</Label>
                <TextArea id="prompt" fullWidth rows={3} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" isDisabled={busy} isPending={busy}>
                  Add profile
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  isDisabled={busy}
                  onPress={() => {
                    resetCreateForm();
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
        {profiles.length === 0 ? (
          <p className="text-sm text-muted">No profiles yet. Click “Create profile”.</p>
        ) : (
          profiles.map((profile, index) => (
            <Card
              key={profile.id}
              className="lift-card glass-panel fade-in rounded-3xl p-1"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <Card.Content className="list-row gap-4 px-6 py-5">
                <Link to={`/profiles/${profile.id}`} className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-semibold">{profile.title}</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.model || integrations.find((item) => item.id === profile.integration)?.model ? (
                      <Chip size="sm" variant="soft" color="accent">
                        {profile.model ||
                          integrations.find((item) => item.id === profile.integration)?.model ||
                          "Model selected"}
                      </Chip>
                    ) : profile.integration ? (
                      <Chip size="sm" variant="soft">
                        {integrations.find((item) => item.id === profile.integration)?.name || "Integration"}
                      </Chip>
                    ) : null}
                    <Chip
                      size="sm"
                      color={
                        profile.key_mode === "platform" || profile.has_deepseek_key ? "success" : "default"
                      }
                      variant="soft"
                    >
                      {profile.key_mode === "platform"
                        ? "Platform key"
                        : profile.has_deepseek_key
                          ? "Own key"
                          : "No key"}
                    </Chip>
                    {profile.can_edit ? null : (
                      <Chip size="sm" variant="secondary">
                        View only
                      </Chip>
                    )}
                  </div>
                </Link>
                {profile.can_edit ? (
                  <Button
                    variant="danger-soft"
                    size="sm"
                    className="shrink-0"
                    isDisabled={busy}
                    onPress={() => void onDelete(profile.id)}
                  >
                    Delete
                  </Button>
                ) : null}
              </Card.Content>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
