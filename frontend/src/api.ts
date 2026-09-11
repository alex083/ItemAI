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
  is_active: boolean;
};

export type Profile = {
  id: number;
  title: string;
  user: number | null;
  integration: number | null;
  model: string;
  prompt_template: number | null;
  Prompt: string;
  has_deepseek_key: boolean;
  can_edit: boolean;
};

export type Product = {
  id: number;
  title: string;
  description: string;
  profile: number;
  google_product_category: string;
  external_id: string;
  barcode: string;
  group_id: string;
  created_at?: string;
  google_product_category_path?: string;
  can_edit: boolean;
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

export function createIntegration(payload: { name: string; api_url: string; model: string }) {
  return request<Integration>("/api/integrations/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateIntegration(
  id: number,
  payload: { name?: string; api_url?: string; model?: string; is_active?: boolean },
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
  model?: string;
  DeepSeekApiKey: string;
  Prompt?: string;
}) {
  return request<Profile>("/api/profiles/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateProfile(
  id: number,
  payload: { title?: string; integration?: number; model?: string; DeepSeekApiKey?: string; Prompt?: string },
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

export async function exportProductsToCsv(profileId: number, ids?: number[]) {
  const token = getToken();
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) {
    headers.set("Authorization", `Token ${token}`);
  }

  const response = await fetch("/api/products/export/", {
    method: "POST",
    headers,
    body: JSON.stringify(ids?.length ? { profile: profileId, ids } : { profile: profileId }),
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
