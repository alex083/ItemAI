import { IconLoader2 } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { deleteProduct, generateProduct, getProduct, type Product } from "./api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium">{label}</p>
      <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{value || "—"}</p>
    </div>
  );
}

export function ProductDetailPage() {
  const { id, productId } = useParams();
  const navigate = useNavigate();
  const profileId = Number(id);
  const idNum = Number(productId);
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setProduct(await getProduct(idNum));
  }

  useEffect(() => {
    if (!idNum) {
      return;
    }
    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not open product");
    });
  }, [idNum]);

  async function onGenerate() {
    setBusy(true);
    setError(null);
    try {
      setProduct(await generateProduct(idNum));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not generate description");
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

  if (!product) {
    return error ? (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    ) : (
      <p className="text-sm text-muted-foreground">Loading…</p>
    );
  }

  const created = product.created_at ? new Date(product.created_at).toLocaleString("en-US") : "—";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to={`/profiles/${profileId}`} className="text-sm text-primary underline-offset-4 hover:underline">
          ← Back to profile
        </Link>
        <h1 className="mt-2 font-heading text-2xl font-medium tracking-tight">{product.title}</h1>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-4">
          {product.can_edit ? (
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => void onGenerate()}>
                {busy ? <IconLoader2 className="animate-spin" /> : null}
                Generate description
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void onDelete()}>
                Delete
              </Button>
            </div>
          ) : null}
          <Field label="Description" value={product.description} />
          <Field label="Google category (id)" value={product.google_product_category} />
          {product.google_product_category_path ? (
            <Field label="Google category (path)" value={product.google_product_category_path} />
          ) : null}
          <Field label="Store ID" value={product.external_id} />
          <Field label="Barcode" value={product.barcode} />
          <Field label="Group ID" value={product.group_id} />
          <Field label="Created" value={created} />
        </CardContent>
      </Card>
    </div>
  );
}
