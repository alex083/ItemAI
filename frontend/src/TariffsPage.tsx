import { type FormEvent, useEffect, useState } from "react";
import { Button, Card, Chip, Input, Label, TextArea } from "@heroui/react";

import {
  createTariff,
  getMySubscription,
  listTariffs,
  subscribeToTariff,
  type KeyPolicy,
  type Tariff,
  type UserSubscription,
} from "./api";
import { useAuth } from "./auth";
import { FieldHint } from "@/components/field-hint";
import { NativeSelect } from "@/components/native-select";
import { PageHeader } from "@/components/page-header";
import { StatusBanner } from "@/components/status-banner";

function policyLabel(policy: KeyPolicy) {
  if (policy === "platform_key") return "Platform key only";
  if (policy === "byok") return "Own key only";
  return "Hybrid";
}

export function TariffsPage() {
  const { user } = useAuth();
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("29.00");
  const [keypolicy, setKeypolicy] = useState<KeyPolicy>("hybrid");
  const [products, setProducts] = useState("100");
  const [profiles, setProfiles] = useState("3");
  const [generations, setGenerations] = useState("100");

  async function refresh() {
    const nextTariffs = await listTariffs();
    setTariffs(nextTariffs);
    try {
      setSubscription(await getMySubscription());
    } catch {
      setSubscription(null);
    }
  }

  useEffect(() => {
    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load tariffs");
    });
  }, []);

  async function onSubscribe(tariffId: number) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      setSubscription(await subscribeToTariff(tariffId));
      setMessage("Tariff applied. Limits added to your subscription.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not subscribe");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateTariff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createTariff({
        title: title.trim(),
        description: description.trim(),
        price,
        keypolicy,
        number_of_products: Number(products),
        number_of_profiles: Number(profiles),
        number_of_generations: Number(generations),
        is_active: true,
      });
      setShowForm(false);
      setTitle("");
      setDescription("");
      await refresh();
      setMessage("Tariff created.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create tariff");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="Tariffs"
        description="Choose a plan. Buying again adds capacity to your current subscription."
        action={
          user?.is_staff && !showForm ? (
            <Button className="shrink-0" onPress={() => setShowForm(true)}>
              Create tariff
            </Button>
          ) : null
        }
      />

      {error ? <StatusBanner>{error}</StatusBanner> : null}
      {message ? <StatusBanner status="success">{message}</StatusBanner> : null}

      {subscription ? (
        <Card className="glass-panel fade-in rounded-3xl p-1">
          <Card.Header className="px-6 pt-6">
            <Card.Title>Current subscription</Card.Title>
            <Card.Description>
              {subscription.tariff_title} · {policyLabel(subscription.keypolicy)}
            </Card.Description>
          </Card.Header>
          <Card.Content className="px-6 pb-6">
            <div className="flex flex-wrap gap-2">
              <Chip size="sm" variant="soft">
                Profiles {subscription.profile_usage}/{subscription.profile_limit}
              </Chip>
              <Chip size="sm" variant="soft">
                Products {subscription.product_usage}/{subscription.product_limit}
              </Chip>
                    <Chip size="sm" variant="soft" color="accent">
                Generations {subscription.generation_usage}/{subscription.generation_limit}
              </Chip>
            </div>
            <p className="mt-3 text-sm text-muted">
              Generation credits are used only with the platform key. Own-key generates are free of this limit.
            </p>
          </Card.Content>
        </Card>
      ) : (
        <p className="text-sm text-muted">No active subscription yet. Pick a tariff below.</p>
      )}

      {showForm ? (
        <Card className="glass-panel fade-in rounded-3xl p-1">
          <Card.Header className="px-6 pt-6">
            <Card.Title>New tariff</Card.Title>
          </Card.Header>
          <Card.Content className="px-6 pb-6">
            <form className="flex flex-col gap-5" onSubmit={onCreateTariff}>
              <div className="space-y-2.5">
                <Label htmlFor="tariff-title">Title</Label>
                <Input id="tariff-title" fullWidth value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="tariff-desc">Description</Label>
                <TextArea
                  id="tariff-desc"
                  fullWidth
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2.5">
                  <Label htmlFor="tariff-price">Price</Label>
                  <Input
                    id="tariff-price"
                    fullWidth
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="tariff-policy">Key policy</Label>
                  <NativeSelect
                    id="tariff-policy"
                    value={keypolicy}
                    onChange={(e) => setKeypolicy(e.target.value as KeyPolicy)}
                  >
                    <option value="hybrid">Hybrid</option>
                    <option value="platform_key">Platform key only</option>
                    <option value="byok">Own key only</option>
                  </NativeSelect>
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="tariff-products">Products</Label>
                  <Input
                    id="tariff-products"
                    fullWidth
                    value={products}
                    onChange={(e) => setProducts(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="tariff-profiles">Profiles</Label>
                  <Input
                    id="tariff-profiles"
                    fullWidth
                    value={profiles}
                    onChange={(e) => setProfiles(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="tariff-gens">Generations</Label>
                  <Input
                    id="tariff-gens"
                    fullWidth
                    value={generations}
                    onChange={(e) => setGenerations(e.target.value)}
                    required
                  />
                  <FieldHint>Counted only when using the platform key.</FieldHint>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" isDisabled={busy} isPending={busy}>
                  Save tariff
                </Button>
                <Button variant="outline" type="button" isDisabled={busy} onPress={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3">
        {tariffs.length === 0 ? (
          <p className="text-sm text-muted">No tariffs yet. Staff can create the first plan.</p>
        ) : (
          tariffs.map((tariff, index) => (
            <Card
              key={tariff.id}
              className="lift-card glass-panel fade-in rounded-3xl p-1"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <Card.Content className="list-row flex-wrap gap-4 px-6 py-5">
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-semibold">{tariff.title}</h2>
                  {tariff.description ? (
                    <p className="mt-1.5 text-sm text-muted">{tariff.description}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Chip size="sm" variant="soft" color="accent">
                      ${tariff.price}
                    </Chip>
                    <Chip size="sm" variant="soft">
                      {policyLabel(tariff.keypolicy)}
                    </Chip>
                    <Chip size="sm" variant="soft">
                      {tariff.number_of_profiles} profiles
                    </Chip>
                    <Chip size="sm" variant="soft">
                      {tariff.number_of_products} products
                    </Chip>
                    <Chip size="sm" variant="soft">
                      {tariff.number_of_generations} generations
                    </Chip>
                  </div>
                </div>
                <Button size="sm" className="shrink-0" isDisabled={busy} onPress={() => void onSubscribe(tariff.id)}>
                  {subscription ? "Buy / add capacity" : "Choose plan"}
                </Button>
              </Card.Content>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
