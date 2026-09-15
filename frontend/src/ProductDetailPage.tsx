import {
  IconDots,
  IconDownload,
  IconLoader2,
  IconPhoto,
  IconStar,
  IconStarFilled,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import { type DragEvent, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Dropdown, Input, Label, TextArea, toast } from "@heroui/react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { cn } from "cn";

import {
  deleteProduct,
  deleteProductImage,
  generateProduct,
  generateProductImage,
  getMySubscription,
  getProduct,
  setPrimaryProductImage,
  updateProduct,
  uploadProductImage,
  type Product,
  type ProductImage,
} from "./api";
import { ConfirmDialog } from "@/components/confirm-dialog";
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

type ProductTab = "photos" | "general" | "seo" | "ecommerce" | "identifiers";

const PRODUCT_TABS: { value: ProductTab; label: string }[] = [
  { value: "photos", label: "Photos" },
  { value: "general", label: "General" },
  { value: "seo", label: "SEO" },
  { value: "ecommerce", label: "Catalog" },
  { value: "identifiers", label: "IDs" },
];

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

function ImageActionsMenu({
  image,
  busy,
  onDownload,
  onSetPrimary,
  onDelete,
}: {
  image: ProductImage;
  busy: boolean;
  onDownload: () => void;
  onSetPrimary: () => void;
  onDelete: () => void;
}) {
  return (
    <Dropdown>
      <Button
        variant="secondary"
        size="sm"
        aria-label="Image actions"
        className="absolute right-2 top-2 z-10 bg-white/90 shadow-sm backdrop-blur-sm"
        isDisabled={busy}
      >
        <IconDots className="size-4" />
      </Button>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          aria-label="Image actions"
          onAction={(key) => {
            if (key === "download") onDownload();
            if (key === "primary") onSetPrimary();
            if (key === "delete") onDelete();
          }}
          disabledKeys={[
            ...(busy ? (["download", "primary", "delete"] as const) : []),
            ...(image.is_primary ? (["primary"] as const) : []),
          ]}
        >
          <Dropdown.Item id="download" textValue="Download">
            <IconDownload className="size-4" />
            <Label>Download</Label>
          </Dropdown.Item>
          <Dropdown.Item id="primary" textValue="Set as primary">
            {image.is_primary ? <IconStarFilled className="size-4 text-accent" /> : <IconStar className="size-4" />}
            <Label>{image.is_primary ? "Primary image" : "Set as primary"}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="delete" textValue="Delete" variant="danger">
            <IconTrash className="size-4" />
            <Label>Delete</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

export function ProductDetailPage() {
  const { id, productId } = useParams();
  const navigate = useNavigate();
  const profileId = Number(id);
  const idNum = Number(productId);
  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [imageGenAllowed, setImageGenAllowed] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [imageGenPrompt, setImageGenPrompt] = useState("");
  const [imageDragActive, setImageDragActive] = useState(false);
  const [activeTab, setActiveTab] = useState<ProductTab>("photos");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteImageTarget, setDeleteImageTarget] = useState<ProductImage | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const isDirty = useMemo(() => {
    if (!product || !form) return false;
    return JSON.stringify(form) !== JSON.stringify(productToForm(product));
  }, [product, form]);

  function applyProduct(next: Product) {
    setProduct(next);
    setForm(productToForm(next));
  }

  async function refresh() {
    applyProduct(await getProduct(idNum));
    try {
      const subscription = await getMySubscription();
      setImageGenAllowed(subscription.image_generation_limit > 0);
    } catch {
      setImageGenAllowed(false);
    }
  }

  useEffect(() => {
    if (!idNum) {
      return;
    }
    refresh().catch((err: unknown) => {
      setLoadError(err instanceof Error ? err.message : "Could not open product");
    });
  }, [idNum]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  function notifySuccess(message: string) {
    toast.success(message);
  }

  function notifyError(message: string) {
    toast.danger(message);
  }

  async function onGenerate() {
    setBusy(true);
    try {
      applyProduct(await generateProduct(idNum));
      notifySuccess("Generated content saved.");
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : "Could not generate product content");
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
      notifySuccess("Product saved.");
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : "Could not save product");
    } finally {
      setBusy(false);
    }
  }

  async function onConfirmDeleteProduct() {
    setBusy(true);
    try {
      await deleteProduct(idNum);
      navigate(`/profiles/${profileId}`);
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : "Could not delete product");
      setBusy(false);
    }
  }

  async function onGenerateImage() {
    setImageBusy(true);
    try {
      await generateProductImage(idNum, imageGenPrompt);
      await refresh();
      notifySuccess("Image generated.");
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : "Could not generate image");
    } finally {
      setImageBusy(false);
    }
  }

  async function onUploadImage(file: File) {
    if (!file.type.startsWith("image/")) {
      notifyError("Please choose an image file.");
      return;
    }
    setUploadBusy(true);
    try {
      await uploadProductImage(idNum, file);
      await refresh();
      notifySuccess("Image uploaded.");
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : "Could not upload image");
    } finally {
      setUploadBusy(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  }

  async function onConfirmDeleteImage() {
    if (!deleteImageTarget) return;
    setBusy(true);
    try {
      await deleteProductImage(deleteImageTarget.id);
      setDeleteImageTarget(null);
      await refresh();
      notifySuccess("Image deleted.");
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : "Could not delete image");
    } finally {
      setBusy(false);
    }
  }

  async function onSetPrimaryImage(imageId: number) {
    setBusy(true);
    try {
      await setPrimaryProductImage(imageId);
      await refresh();
      notifySuccess("Primary image updated.");
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : "Could not set primary image");
    } finally {
      setBusy(false);
    }
  }

  async function onDownloadImage(imageUrl: string, filename: string) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Could not fetch image");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : "Could not download image");
    }
  }

  function onImageDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!uploadBusy) {
      setImageDragActive(true);
    }
  }

  function onImageDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setImageDragActive(false);
  }

  function onImageDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setImageDragActive(false);
    if (uploadBusy || !product?.can_edit) return;
    const file = event.dataTransfer.files?.[0] ?? null;
    if (file) {
      void onUploadImage(file);
    }
  }

  if (!product || !form) {
    return loadError ? (
      <StatusBanner>{loadError}</StatusBanner>
    ) : (
      <p className="text-sm text-muted">Loading…</p>
    );
  }

  const created = product.created_at ? new Date(product.created_at).toLocaleString("en-US") : "—";
  const canEdit = product.can_edit;

  return (
    <div className={cn("page-stack", isDirty && canEdit && "pb-20")}>
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
            <Button variant="danger-soft" size="sm" isDisabled={busy} onPress={() => setShowDeleteConfirm(true)}>
              Delete
            </Button>
          </div>
        ) : null}
      </div>

      <form id="product-edit-form" onSubmit={onSave}>
        <Card className="glass-panel fade-in rounded-3xl p-1">
          <Card.Header className="space-y-4 px-6 pt-6">
            <div>
              <Card.Title>Product</Card.Title>
              <Card.Description>
                Photos, copy, SEO, catalog fields, and store identifiers — switch sections without scrolling a long form.
              </Card.Description>
            </div>
            <div
              className="flex w-full gap-1 overflow-x-auto rounded-xl border border-divider bg-background p-1"
              role="tablist"
              aria-label="Product sections"
            >
              {PRODUCT_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.value}
                  className={cn(
                    "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                    activeTab === tab.value
                      ? "bg-foreground text-background"
                      : "text-muted hover:text-foreground",
                  )}
                  onClick={() => setActiveTab(tab.value)}
                >
                  {tab.label}
                  {tab.value === "photos" && product.images.length > 0
                    ? ` (${product.images.length})`
                    : null}
                </button>
              ))}
            </div>
          </Card.Header>

          <Card.Content className="px-6 pb-6">
            {activeTab === "photos" ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="max-w-xl text-sm text-muted">
                    {imageGenAllowed
                      ? "Upload a real product photo first, then Generate to create a studio version of that same product."
                      : "Your plan does not include image generation. You can still upload photos."}
                  </p>
                  {canEdit ? (
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void onUploadImage(file);
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        isDisabled={uploadBusy}
                        onPress={() => imageInputRef.current?.click()}
                      >
                        {uploadBusy ? (
                          <IconLoader2 className="size-4 animate-spin" />
                        ) : (
                          <IconUpload className="size-4" />
                        )}
                        Upload
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        isDisabled={imageBusy || !imageGenAllowed || product.images.length === 0}
                        onPress={() => void onGenerateImage()}
                      >
                        {imageBusy ? (
                          <IconLoader2 className="size-4 animate-spin" />
                        ) : (
                          <IconPhoto className="size-4" />
                        )}
                        Generate image
                      </Button>
                    </div>
                  ) : null}
                </div>

                {canEdit && imageGenAllowed ? (
                  <div className="space-y-2.5">
                    <Label htmlFor="image-gen-prompt">Image prompt (optional)</Label>
                    <TextArea
                      id="image-gen-prompt"
                      fullWidth
                      variant="secondary"
                      rows={3}
                      value={imageGenPrompt}
                      disabled={imageBusy}
                      placeholder="e.g. White background, soft studio light, keep the product exactly as in the photo"
                      onChange={(event) => setImageGenPrompt(event.target.value)}
                    />
                    <p className="text-sm text-muted">
                      Overrides the profile image prompt for this generation. Uses the primary/uploaded photo as
                      reference.
                    </p>
                  </div>
                ) : null}

                {canEdit ? (
                  <div
                    className={cn(
                      "rounded-2xl border border-dashed px-4 py-8 text-center transition-colors",
                      imageDragActive
                        ? "border-[var(--accent)] bg-[var(--accent)]/5"
                        : "border-divider bg-surface-secondary/60",
                      uploadBusy && "pointer-events-none opacity-70",
                    )}
                    onDragOver={onImageDragOver}
                    onDragLeave={onImageDragLeave}
                    onDrop={onImageDrop}
                  >
                    <IconUpload className="mx-auto size-7 text-muted" />
                    <p className="mt-2 text-sm font-medium">
                      {imageDragActive ? "Drop image to upload" : "Drag & drop a product photo here"}
                    </p>
                    <p className="mt-1 text-xs text-muted">or use the Upload button above</p>
                  </div>
                ) : null}

                {product.images.length === 0 && !uploadBusy ? (
                  <p className="text-sm text-muted">
                    No images yet. Upload a real product photo, then use Generate image to improve it for your store.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {product.images.map((image) => (
                      <div
                        key={image.id}
                        className="relative aspect-square overflow-hidden rounded-2xl border border-divider bg-surface-secondary"
                      >
                        <img src={image.image} alt={product.title} className="h-full w-full object-cover" />
                        {image.is_primary ? (
                          <span className="absolute left-2 top-2 rounded-full bg-accent/90 px-2 py-0.5 text-xs font-medium text-accent-foreground">
                            Primary
                          </span>
                        ) : null}
                        {canEdit ? (
                          <ImageActionsMenu
                            image={image}
                            busy={busy}
                            onDownload={() =>
                              void onDownloadImage(
                                image.image,
                                image.image.split("/").pop() || `${product.title}-${image.id}.png`,
                              )
                            }
                            onSetPrimary={() => void onSetPrimaryImage(image.id)}
                            onDelete={() => setDeleteImageTarget(image)}
                          />
                        ) : null}
                      </div>
                    ))}
                    {uploadBusy ? (
                      <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-divider bg-surface-secondary">
                        <IconLoader2 className="size-6 animate-spin text-muted" />
                        <span className="text-xs text-muted">Uploading…</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "general" ? (
              <div className="grid gap-5 md:grid-cols-2">
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
              </div>
            ) : null}

            {activeTab === "seo" ? (
              <div className="grid gap-5 md:grid-cols-2">
                <FieldBlock label="Meta title" htmlFor="meta_title" className="md:col-span-2">
                  <Input
                    id="meta_title"
                    fullWidth
                    variant="secondary"
                    value={form.meta_title}
                    disabled={!canEdit || busy}
                    onChange={(event) => setField("meta_title", event.target.value)}
                  />
                </FieldBlock>
                <FieldBlock label="Meta description" htmlFor="meta_description" className="md:col-span-2">
                  <TextArea
                    id="meta_description"
                    fullWidth
                    variant="secondary"
                    rows={4}
                    value={form.meta_description}
                    disabled={!canEdit || busy}
                    onChange={(event) => setField("meta_description", event.target.value)}
                  />
                </FieldBlock>
              </div>
            ) : null}

            {activeTab === "ecommerce" ? (
              <div className="grid gap-5 md:grid-cols-2">
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
              </div>
            ) : null}

            {activeTab === "identifiers" ? (
              <div className="grid gap-5 md:grid-cols-2">
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
                <FieldBlock label="Group ID" htmlFor="group_id" className="md:col-span-2">
                  <Input
                    id="group_id"
                    fullWidth
                    variant="secondary"
                    value={form.group_id}
                    disabled={!canEdit || busy}
                    onChange={(event) => setField("group_id", event.target.value)}
                  />
                </FieldBlock>
              </div>
            ) : null}

            {canEdit ? (
              activeTab !== "photos" || isDirty ? (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-5">
                  <Button type="submit" isDisabled={busy || !isDirty} isPending={busy}>
                    {busy ? <IconLoader2 className="animate-spin" /> : null}
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    isDisabled={busy}
                    onPress={() => {
                      if (isDirty) {
                        setForm(productToForm(product));
                        toast.info("Changes discarded.");
                        return;
                      }
                      navigate(`/profiles/${profileId}`);
                    }}
                  >
                    {isDirty ? "Discard changes" : "Cancel"}
                  </Button>
                </div>
              ) : null
            ) : activeTab !== "photos" ? (
              <p className="mt-6 text-sm text-muted">Shared product. View only.</p>
            ) : null}
          </Card.Content>
        </Card>
      </form>

      {canEdit && isDirty ? (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 pointer-events-none">
          <Alert status="warning" className="pointer-events-auto w-full max-w-lg shadow-lg">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Unsaved changes</Alert.Title>
              <Alert.Description>Save before leaving this page or your edits will be lost.</Alert.Description>
            </Alert.Content>
            <Button
              form="product-edit-form"
              type="submit"
              size="sm"
              isDisabled={busy}
              isPending={busy}
            >
              Save now
            </Button>
          </Alert>
        </div>
      ) : null}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete "${product.title}"?`}
        description="This permanently removes the product, its description, and its images. This cannot be undone."
        confirmLabel="Delete product"
        busy={busy}
        onConfirm={() => void onConfirmDeleteProduct()}
      />

      <ConfirmDialog
        isOpen={deleteImageTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteImageTarget(null);
        }}
        title="Delete this image?"
        description="This permanently removes the image from the product. This cannot be undone."
        confirmLabel="Delete image"
        busy={busy}
        onConfirm={() => void onConfirmDeleteImage()}
      />
    </div>
  );
}
