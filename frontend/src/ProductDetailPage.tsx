import { IconLoader2 } from "@tabler/icons-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Button, Card, Input, Label, TextArea } from "@heroui/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { cn } from "cn";

import { deleteProduct, generateProduct, getProduct, updateProduct, type Product } from "./api";
import { StatusBanner } from "@/components/status-banner";

type FormState = {
  title: string;
  short_description: string;
  description: string;
  bullet_points: string;
  product_type: string;
  tags: string;
  meta_title: string;
  meta_description: string;
  google_product_category: string;
  google_product_category_path: string;
  external_id: string;
  barcode: string;
  group_id: string;
};

function productToForm(product: Product): FormState {
  const bullets = Array.isArray(product.bullet_points) ? product.bullet_points : [];
  return {
    title: product.title || "",
    short_description: product.short_description || "",
    description: product.description || "",
    bullet_points: bullets.join("\n"),
    product_type: product.product_type || "",
    tags: product.tags || "",
    meta_title: product.meta_title || "",
    meta_description: product.meta_description || "",
    google_product_category: product.google_product_category || "",
    google_product_category_path: product.google_product_category_path || "",
    external_id: product.external_id || "",
    barcode: product.barcode || "",
    group_id: product.group_id || "",
  };
}

function FieldBlock({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/60 bg-white/55 p-4 shadow-[0_1px_0_oklch(1_0_0_/_0.4)_inset] backdrop-blur-sm",
        className,
      )}
    >
      <Label htmlFor={htmlFor} className="mb-2 block">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function ProductDetailPage() {
  const { id, productId } = useParams();
  const navigate = useNavigate();
  const profileId = Number(id);
  const idNum = Number(productId);
  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function applyProduct(next: Product) {
    setProduct(next);
    setForm(productToForm(next));
  }

  async function refresh() {
    applyProduct(await getProduct(idNum));
  }

  useEffect(() => {
    if (!idNum) {
      return;
    }
    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not open product");
    });
  }, [idNum]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function onGenerate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      applyProduct(await generateProduct(idNum));
      setMessage("Generated content saved.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not generate product content");
    } finally {
      setBusy(false);
    }
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const bullet_points = form.bullet_points
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
      applyProduct(
        await updateProduct(idNum, {
          title: form.title.trim(),
          short_description: form.short_description.trim(),
          description: form.description.trim(),
          bullet_points,
          product_type: form.product_type.trim(),
          tags: form.tags.trim(),
          meta_title: form.meta_title.trim(),
          meta_description: form.meta_description.trim(),
          google_product_category: form.google_product_category.trim(),
          google_product_category_path: form.google_product_category_path.trim(),
          external_id: form.external_id.trim(),
          barcode: form.barcode.trim(),
          group_id: form.group_id.trim(),
        }),
      );
      setMessage("Product saved.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save product");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteProduct(idNum);
      navigate(`/profiles/${profileId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete product");
      setBusy(false);
    }
  }

  if (!product || !form) {
    return error ? (
      <StatusBanner>{error}</StatusBanner>
    ) : (
      <p className="text-sm text-muted">Loading…</p>
    );
  }

  const created = product.created_at ? new Date(product.created_at).toLocaleString("en-US") : "—";
  const canEdit = product.can_edit;

  return (
    <div className="page-stack">
      <div className="fade-in flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            to={`/profiles/${profileId}`}
            className="text-sm font-medium text-[var(--accent)] underline-offset-4 hover:underline"
          >
            ← Back to profile
          </Link>
          <h1 className="mt-3 font-display text-3xl font-semibold md:text-4xl">{product.title}</h1>
          <p className="mt-2 text-[0.95rem] text-muted">Created {created}</p>
        </div>
        {canEdit ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" isDisabled={busy} isPending={busy} onPress={() => void onGenerate()}>
              {busy ? <IconLoader2 className="animate-spin" /> : null}
              Generate content
            </Button>
            <Button variant="danger-soft" size="sm" isDisabled={busy} onPress={() => void onDelete()}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      {error ? <StatusBanner>{error}</StatusBanner> : null}
      {message ? <StatusBanner status="success">{message}</StatusBanner> : null}

      <form onSubmit={onSave}>
        <Card className="glass-panel fade-in rounded-3xl p-1">
          <Card.Content className="grid gap-5 px-6 py-6 md:grid-cols-2">
            <FieldBlock label="Title" htmlFor="title" className="md:col-span-2">
              <Input
                id="title"
                fullWidth
                variant="secondary"
                value={form.title}
                disabled={!canEdit || busy}
                onChange={(event) => setField("title", event.target.value)}
                required
              />
            </FieldBlock>

            <FieldBlock label="Short description" htmlFor="short_description">
              <TextArea
                id="short_description"
                fullWidth
                variant="secondary"
                rows={4}
                value={form.short_description}
                disabled={!canEdit || busy}
                onChange={(event) => setField("short_description", event.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Bullet points" htmlFor="bullet_points">
              <TextArea
                id="bullet_points"
                fullWidth
                variant="secondary"
                rows={4}
                value={form.bullet_points}
                disabled={!canEdit || busy}
                placeholder="One benefit per line"
                onChange={(event) => setField("bullet_points", event.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Description" htmlFor="description" className="md:col-span-2">
              <TextArea
                id="description"
                fullWidth
                variant="secondary"
                rows={6}
                value={form.description}
                disabled={!canEdit || busy}
                onChange={(event) => setField("description", event.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Product type" htmlFor="product_type">
              <Input
                id="product_type"
                fullWidth
                variant="secondary"
                value={form.product_type}
                disabled={!canEdit || busy}
                onChange={(event) => setField("product_type", event.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Tags" htmlFor="tags">
              <Input
                id="tags"
                fullWidth
                variant="secondary"
                value={form.tags}
                disabled={!canEdit || busy}
                placeholder="comma, separated, tags"
                onChange={(event) => setField("tags", event.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Meta title" htmlFor="meta_title">
              <Input
                id="meta_title"
                fullWidth
                variant="secondary"
                value={form.meta_title}
                disabled={!canEdit || busy}
                onChange={(event) => setField("meta_title", event.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Meta description" htmlFor="meta_description">
              <TextArea
                id="meta_description"
                fullWidth
                variant="secondary"
                rows={3}
                value={form.meta_description}
                disabled={!canEdit || busy}
                onChange={(event) => setField("meta_description", event.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Google category (id)" htmlFor="google_product_category">
              <Input
                id="google_product_category"
                fullWidth
                variant="secondary"
                value={form.google_product_category}
                disabled={!canEdit || busy}
                onChange={(event) => setField("google_product_category", event.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Google category (path)" htmlFor="google_product_category_path">
              <Input
                id="google_product_category_path"
                fullWidth
                variant="secondary"
                value={form.google_product_category_path}
                disabled={!canEdit || busy}
                onChange={(event) => setField("google_product_category_path", event.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Store ID" htmlFor="external_id">
              <Input
                id="external_id"
                fullWidth
                variant="secondary"
                value={form.external_id}
                disabled={!canEdit || busy}
                onChange={(event) => setField("external_id", event.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Barcode" htmlFor="barcode">
              <Input
                id="barcode"
                fullWidth
                variant="secondary"
                value={form.barcode}
                disabled={!canEdit || busy}
                onChange={(event) => setField("barcode", event.target.value)}
              />
            </FieldBlock>

            <FieldBlock label="Group ID" htmlFor="group_id">
              <Input
                id="group_id"
                fullWidth
                variant="secondary"
                value={form.group_id}
                disabled={!canEdit || busy}
                onChange={(event) => setField("group_id", event.target.value)}
              />
            </FieldBlock>

            {canEdit ? (
              <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-2">
                <Button type="submit" isDisabled={busy} isPending={busy}>
                  {busy ? <IconLoader2 className="animate-spin" /> : null}
                  Save changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  isDisabled={busy}
                  onPress={() => navigate(`/profiles/${profileId}`)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted md:col-span-2">Shared product. View only.</p>
            )}
          </Card.Content>
        </Card>
      </form>
    </div>
  );
}
