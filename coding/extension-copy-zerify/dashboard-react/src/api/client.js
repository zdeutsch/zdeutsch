export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function toQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value));
    }
  });
  return query.toString();
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`/api${path}`, {
    method: options.method || "GET",
    headers,
    signal: options.signal,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new ApiError(
      payload?.message || `Request failed (${response.status})`,
      response.status,
      payload?.details || null
    );
  }
  return payload.data === undefined ? payload : payload.data;
}

let repositoryReadyPromise = null;

export function resetRepositoryReady() {
  repositoryReadyPromise = null;
}

export async function ensureRepositoryReady() {
  if (!repositoryReadyPromise) {
    repositoryReadyPromise = apiRequest("/repository/sync", {
      method: "POST",
      body: {}
    }).catch((error) => {
      repositoryReadyPromise = null;
      throw error;
    });
  }
  return repositoryReadyPromise;
}

export async function mutationRequest(path, options = {}) {
  await ensureRepositoryReady();
  return apiRequest(path, options);
}
