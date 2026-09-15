import { IconTrash } from "@tabler/icons-react";
import { type FormEvent, useEffect, useState } from "react";
import { Button, Card, Chip, Input, Label, Modal, TextArea } from "@heroui/react";
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
import { ConfirmDialog } from "@/components/confirm-dialog";
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

function profileInitial(title: string) {
  const trimmed = title.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
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
  const [imageModel, setImageModel] = useState("");
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);

  const keyModeOptions = allowedKeyModes(keyPolicy);

  function resetCreateForm() {
    setTitle("");
    setIntegrationId(pickDefaultIntegration(integrations));
    setKeyMode(defaultKeyMode(keyPolicy));
    setModel("");
    setImageModel("");
    setModels([]);
    setApiKey("");
    setPrompt("");
    setImagePrompt("");
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
        image_model: imageModel.trim(),
        DeepSeekApiKey: keyMode === "byok" ? apiKey.trim() : "",
        Prompt: prompt.trim(),
        image_prompt: imagePrompt.trim(),
      });
      resetCreateForm();
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create profile");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    try {
      await deleteProfile(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete profile");
    } finally {
      setBusy(false);
    }
  }

  function openCreateModal() {
    setShowCreateForm(true);
    setError(null);
    if (integrationId) {
      void loadModels(integrationId, keyMode === "byok" ? apiKey : "");
    }
  }

  function handleCreateOpenChange(open: boolean) {
    if (open) {
      openCreateModal();
      return;
    }
    resetCreateForm();
    setError(null);
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Profiles"
        description="Open a profile to add products."
        action={
          <Button className="shrink-0" onPress={openCreateModal}>
            Create profile
          </Button>
        }
      />
      {error ? <StatusBanner>{error}</StatusBanner> : null}

      <Modal.Backdrop isOpen={showCreateForm} onOpenChange={handleCreateOpenChange}>
        <Modal.Container size="lg" scroll="inside" placement="center">
          <Modal.Dialog className="glass-panel">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>New profile</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <form className="flex flex-col gap-5" onSubmit={onCreate}>
                <div className="space-y-2.5">
                  <Label htmlFor="shop">Shop name</Label>
                  <Input
                    id="shop"
                    fullWidth
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                  />
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
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="profile-image-model">Image model (optional)</Label>
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
                      id="profile-image-model"
                      value={imageModel}
                      onChange={(event) => setImageModel(event.target.value)}
                    >
                      <option value="">No image model</option>
                      {integrations
                        .find((item) => String(item.id) === integrationId)
                        ?.api_url?.includes("openrouter.ai") ? (
                        <>
                          <option value="openrouter/auto-beta">openrouter/auto-beta (auto router)</option>
                          <option value="openrouter/auto">openrouter/auto (legacy auto)</option>
                        </>
                      ) : null}
                      {models.map((item) => (
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
                      onChange={(event) => setImageModel(event.target.value)}
                      placeholder="e.g. openrouter/auto-beta"
                    />
                  )}
                  <FieldHint>
                    Only used if your plan includes image generation. For OpenRouter, openrouter/auto-beta lets
                    OpenRouter pick an image model automatically.
                  </FieldHint>
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="prompt">Custom text prompt (optional)</Label>
                  <TextArea
                    id="prompt"
                    fullWidth
                    rows={3}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                  />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="image-prompt">Image prompt (optional)</Label>
                  <TextArea
                    id="image-prompt"
                    fullWidth
                    rows={3}
                    value={imagePrompt}
                    onChange={(event) => setImagePrompt(event.target.value)}
                    placeholder="Studio style instructions for product photos"
                  />
                  <FieldHint>
                    Used with an uploaded product photo as reference. Placeholders: {"{title}"}, {"{description}"},{" "}
                    {"{product_type}"}, {"{tags}"}.
                  </FieldHint>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
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
        description="This permanently deletes the profile and every product, image, and description inside it. This cannot be undone."
        confirmLabel="Delete profile"
        busy={busy}
        onConfirm={() => void onConfirmDelete()}
      />

      {profiles.length === 0 ? (
        <p className="text-sm text-muted">No profiles yet. Click “Create profile”.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile, index) => (
            <Card
              key={profile.id}
              className="glass-panel fade-in group relative rounded-3xl p-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_oklch(0.35_0.05_220_/_0.12)]"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <Card.Content className="relative flex flex-col gap-4 px-5 py-5">
                {profile.can_edit ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-3 top-3 z-10 opacity-60 transition-all duration-200 hover:bg-danger/10 hover:text-danger hover:opacity-100"
                    aria-label={`Delete ${profile.title}`}
                    isDisabled={busy}
                    onPress={() => setDeleteTarget(profile)}
                  >
                    <IconTrash className="size-4" />
                  </Button>
                ) : null}

                <Link
                  to={`/profiles/${profile.id}`}
                  className="flex min-w-0 items-start gap-3.5 pr-8 transition-all duration-200"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-sm font-bold text-accent">
                    {profileInitial(profile.title)}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h2 className="truncate font-display text-lg font-semibold leading-snug">
                      {profile.title}
                    </h2>
                    <p className="mt-1 text-xs text-muted">
                      {integrations.find((item) => item.id === profile.integration)?.name || "No integration"}
                    </p>
                  </div>
                </Link>

                <div className="flex flex-wrap gap-2">
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
              </Card.Content>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
