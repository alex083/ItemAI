const TOKEN_KEY = "itemai_token";

export type AuthUser = {
  id: number;
  username: string;
  email?: string;
  is_staff: boolean;
};

export type AuthResponse = AuthUser & {
  token: string;
};

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function isLoggedIn() {
  return Boolean(getToken());
}

async function readError(response: Response) {
  const data: unknown = await response.json().catch(() => null);
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (typeof record.detail === "string") {
      return record.detail;
    }
    const messages = Object.values(record).flatMap((value) =>
      Array.isArray(value) ? value.map(String) : [String(value)],
    );
    if (messages.length) {
      return messages.join(" ");
    }
  }
  return `Request failed: ${response.status}`;
}

async function request<T>(path: string, init?: RequestInit, json = true): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  if (json) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Token ${token}`);
  }

  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function login(username: string, password: string) {
  return request<AuthResponse>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function register(username: string, email: string, password: string) {
  return request<AuthResponse>("/api/auth/register/", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

export function getMe() {
  return request<AuthUser>("/api/auth/me/");
}

export type Integration = {
  id: number;
  name: string;
  api_url: string;
  model: string;
  image_model: string;
  has_api_key: boolean;
  is_platform_default: boolean;
  is_active: boolean;
};

export type ProfileKeyMode = "platform" | "byok";

export type Profile = {
  id: number;
  title: string;
  user: number | null;
  integration: number | null;
  key_mode: ProfileKeyMode;
  model: string;
  image_model: string;
  prompt_template: number | null;
  Prompt: string;
  image_prompt: string;
  has_deepseek_key: boolean;
  can_edit: boolean;
};

export type ProductImageSource = "generated" | "uploaded";

export type ProductImage = {
  id: number;
  product: number;
  image: string;
  source: ProductImageSource;
  is_primary: boolean;
  created_at: string;
};

export type Product = {
  id: number;
  title: string;
  description: string;
  short_description: string;
  meta_title: string;
  meta_description: string;
  bullet_points: string[];
  tags: string;
  product_type: string;
  profile: number;
  google_product_category: string;
  google_product_category_path: string;
  external_id: string;
  barcode: string;
  group_id: string;
  created_at?: string;
  can_edit: boolean;
  images: ProductImage[];
};

export type PromptTemplate = {
  id: number;
  slug: string;
  title: string;
  body: string;
  owner: number | null;
  can_edit: boolean;
};

export function listIntegrations() {
  return request<Integration[]>("/api/integrations/");
}

export function createIntegration(payload: {
  name: string;
  api_url: string;
  model: string;
  image_model?: string;
  api_key?: string;
  is_platform_default?: boolean;
  is_active?: boolean;
}) {
  return request<Integration>("/api/integrations/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateIntegration(
  id: number,
  payload: {
    name?: string;
    api_url?: string;
    model?: string;
    image_model?: string;
    api_key?: string;
    is_platform_default?: boolean;
    is_active?: boolean;
  },
) {
  return request<Integration>(`/api/integrations/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteIntegration(id: number) {
  return request<void>(`/api/integrations/${id}/`, { method: "DELETE" });
}

export type ProviderModel = {
  id: string;
  name: string;
};

export function listAvailableModels(payload: {
  api_url?: string;
  integration?: number;
  profile?: number;
  api_key?: string;
}) {
  return request<{ models: ProviderModel[] }>("/api/integrations/available-models/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listPromptTemplates() {
  return request<PromptTemplate[]>("/api/prompt-templates/");
}

export function createPromptTemplate(payload: { title: string; body: string }) {
  return request<PromptTemplate>("/api/prompt-templates/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePromptTemplate(id: number, payload: { title?: string; body?: string }) {
  return request<PromptTemplate>(`/api/prompt-templates/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deletePromptTemplate(id: number) {
  return request<void>(`/api/prompt-templates/${id}/`, { method: "DELETE" });
}

export function listProfiles() {
  return request<Profile[]>("/api/profiles/");
}

export function getProfile(id: number) {
  return request<Profile>(`/api/profiles/${id}/`);
}

export function createProfile(payload: {
  title: string;
  integration: number;
  key_mode?: ProfileKeyMode;
  model?: string;
  image_model?: string;
  DeepSeekApiKey?: string;
  Prompt?: string;
  image_prompt?: string;
}) {
  return request<Profile>("/api/profiles/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProfile(
  id: number,
  payload: {
    title?: string;
    integration?: number;
    key_mode?: ProfileKeyMode;
    model?: string;
    image_model?: string;
    DeepSeekApiKey?: string;
    Prompt?: string;
    image_prompt?: string;
  },
) {
  return request<Profile>(`/api/profiles/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteProfile(id: number) {
  return request<void>(`/api/profiles/${id}/`, { method: "DELETE" });
}

export function listProducts() {
  return request<Product[]>("/api/products/");
}

export function getProduct(id: number) {
  return request<Product>(`/api/products/${id}/`);
}

export function updateProduct(
  id: number,
  payload: {
    title?: string;
    description?: string;
    short_description?: string;
    meta_title?: string;
    meta_description?: string;
    bullet_points?: string[];
    tags?: string;
    product_type?: string;
    google_product_category?: string;
    google_product_category_path?: string;
    external_id?: string;
    barcode?: string;
    group_id?: string;
  },
) {
  return request<Product>(`/api/products/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function createProduct(payload: {
  title: string;
  profile: number;
  external_id?: string;
  barcode?: string;
}) {
  return request<Product>("/api/products/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type ProductCsvImportResult = {
  created: number;
  skipped: number;
  errors: { row: number; detail: string }[];
};

export function importProductsFromCsv(profileId: number, file: File) {
  const body = new FormData();
  body.append("profile", String(profileId));
  body.append("file", file);
  return request<ProductCsvImportResult>("/api/products/import/", { method: "POST", body }, false);
}

export async function exportProductsToCsv(profileId: number, ids?: number[], fields?: string[]) {
  const token = getToken();
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) {
    headers.set("Authorization", `Token ${token}`);
  }

  const payload: Record<string, unknown> = { profile: profileId };
  if (ids?.length) {
    payload.ids = ids;
  }
  if (fields?.length) {
    payload.fields = fields;
  }

  const response = await fetch("/api/products/export/", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] || `products-profile-${profileId}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function deleteProduct(id: number) {
  return request<void>(`/api/products/${id}/`, { method: "DELETE" });
}

export function generateProduct(id: number, prompt?: string) {
  return request<Product>(`/api/products/${id}/generate/`, {
    method: "POST",
    body: JSON.stringify(prompt ? { prompt } : {}),
  });
}

export function generateProductImage(id: number, prompt?: string) {
  return request<ProductImage>(`/api/products/${id}/generate-image/`, {
    method: "POST",
    body: JSON.stringify(prompt?.trim() ? { prompt: prompt.trim() } : {}),
  });
}

export function uploadProductImage(id: number, file: File) {
  const body = new FormData();
  body.append("image", file);
  return request<ProductImage>(`/api/products/${id}/images/`, { method: "POST", body }, false);
}

export function deleteProductImage(imageId: number) {
  return request<void>(`/api/product-images/${imageId}/`, { method: "DELETE" });
}

export function setPrimaryProductImage(imageId: number) {
  return request<ProductImage>(`/api/product-images/${imageId}/set-primary/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export type KeyPolicy = "hybrid" | "platform_key" | "byok";

export function allowedKeyModes(policy: KeyPolicy | null | undefined): ProfileKeyMode[] {
  if (policy === "byok") return ["byok"];
  if (policy === "platform_key") return ["platform"];
  return ["platform", "byok"];
}

export function defaultKeyMode(policy: KeyPolicy | null | undefined): ProfileKeyMode {
  return allowedKeyModes(policy)[0] ?? "platform";
}

export type Tariff = {
  id: number;
  title: string;
  description: string;
  price: string;
  keypolicy: KeyPolicy;
  number_of_products: number;
  number_of_profiles: number;
  number_of_generations: number;
  number_of_image_generations: number;
  is_active: boolean;
};

export type UserSubscription = {
  id: number;
  user: number;
  tariff: number;
  tariff_title: string;
  keypolicy: KeyPolicy;
  product_limit: number;
  profile_limit: number;
  generation_limit: number;
  image_generation_limit: number;
  product_usage: number;
  profile_usage: number;
  generation_usage: number;
  image_generation_usage: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
};

export function listTariffs() {
  return request<Tariff[]>("/api/tariffs/");
}

export function createTariff(payload: {
  title: string;
  description?: string;
  price: string | number;
  keypolicy: KeyPolicy;
  number_of_products: number;
  number_of_profiles: number;
  number_of_generations: number;
  number_of_image_generations?: number;
  is_active?: boolean;
}) {
  return request<Tariff>("/api/tariffs/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMySubscription() {
  return request<UserSubscription>("/api/subscriptions/me/");
}

export function subscribeToTariff(tariffId: number) {
  return request<UserSubscription>("/api/subscriptions/subscribe/", {
    method: "POST",
    body: JSON.stringify({ tariff: tariffId }),
  });
}
