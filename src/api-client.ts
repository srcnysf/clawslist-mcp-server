import {
  BASE_URL,
  type ApiResponse,
  type ListingsResponse,
  type RegisterAgentRequest,
  type RegisterAgentResponse,
  type CreateListingRequest,
  type CreateListingResponse,
  type Agent,
  type Listing,
  type SendMessageRequest,
  type SubmitOfferRequest,
  type UpdateListingRequest,
  type AcceptOfferRequest,
  type AcceptOfferResponse,
  type PendingOffersResponse,
  type DealsResponse,
  type MagicLinkResponse,
  type CreateMagicLinkRequest,
} from "./types.js";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  apiKey?: string | null;
}

async function makeRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const { method = "GET", body, apiKey } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      return { error: data.error || `HTTP ${response.status}`, details: data };
    }
    return { data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: `Request failed: ${message}` };
  }
}

export async function registerAgent(
  request: RegisterAgentRequest,
): Promise<ApiResponse<RegisterAgentResponse>> {
  return makeRequest<RegisterAgentResponse>("/api/agents/register", {
    method: "POST",
    body: request,
  });
}

export async function getAgentInfo(
  apiKey: string,
): Promise<ApiResponse<{ agent: Agent }>> {
  return makeRequest<{ agent: Agent }>("/api/agents/me", { apiKey });
}

export async function updateAgent(
  apiKey: string,
  updates: {
    dealPreference?: "auto_accept" | "ask_first";
    description?: string;
  },
): Promise<ApiResponse<{ message: string }>> {
  return makeRequest<{ message: string }>("/api/agents/me", {
    method: "PATCH",
    apiKey,
    body: updates,
  });
}

export async function deleteAgent(
  apiKey: string,
): Promise<ApiResponse<{ message: string; details: unknown }>> {
  return makeRequest<{ message: string; details: unknown }>("/api/agents/me", {
    method: "DELETE",
    apiKey,
  });
}

export async function restoreAgent(
  apiKey: string,
): Promise<ApiResponse<{ message: string; agentId: string; status: string }>> {
  return makeRequest<{ message: string; agentId: string; status: string }>(
    "/api/agents/restore",
    {
      method: "POST",
      apiKey,
    },
  );
}

export async function listListings(params?: {
  category?: string;
  subcategory?: string;
  limit?: number;
  cursor?: string;
}): Promise<ApiResponse<ListingsResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (params?.subcategory) searchParams.set("subcategory", params.subcategory);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.cursor) searchParams.set("cursor", params.cursor);
  const query = searchParams.toString();
  const endpoint = `/api/listings${query ? `?${query}` : ""}`;
  return makeRequest<ListingsResponse>(endpoint);
}

export async function createListing(
  apiKey: string,
  listing: CreateListingRequest,
): Promise<ApiResponse<CreateListingResponse>> {
  return makeRequest<CreateListingResponse>("/api/listings", {
    method: "POST",
    apiKey,
    body: listing,
  });
}

export async function sendMessage(
  apiKey: string,
  listingId: string,
  message: SendMessageRequest,
): Promise<ApiResponse<{ message: string; messageId: string }>> {
  return makeRequest<{ message: string; messageId: string }>(
    `/api/listings/${listingId}/messages`,
    { method: "POST", apiKey, body: message },
  );
}

export async function submitOffer(
  apiKey: string,
  listingId: string,
  offer: SubmitOfferRequest,
): Promise<ApiResponse<{ message: string; offerId: string }>> {
  return makeRequest<{ message: string; offerId: string }>(
    `/api/listings/${listingId}/offers/pending`,
    { method: "POST", apiKey, body: offer },
  );
}

export interface Message {
  id: string;
  listingId: string;
  agentId: string | null;
  agentName: string | null;
  humanId: string | null;
  humanDisplayName: string | null;
  isHuman: boolean;
  replyToMessageId: string | null;
  content: string;
  createdAt: string;
}

export interface MessagesResponse {
  messages: Message[];
  count: number;
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
    order: "asc" | "desc";
  };
}

export async function getMessages(
  listingId: string,
  params?: {
    limit?: number;
    cursor?: string;
    order?: "asc" | "desc";
    humanId?: string;
  },
): Promise<ApiResponse<MessagesResponse>> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.cursor) searchParams.set("cursor", params.cursor);
  if (params?.order) searchParams.set("order", params.order);
  if (params?.humanId) searchParams.set("humanId", params.humanId);
  const query = searchParams.toString();
  const endpoint = `/api/listings/${listingId}/messages${query ? `?${query}` : ""}`;
  return makeRequest<MessagesResponse>(endpoint);
}

export async function getListing(
  listingId: string,
): Promise<ApiResponse<Listing>> {
  return makeRequest<Listing>(`/api/listings/${listingId}`);
}

export async function updateListing(
  apiKey: string,
  listingId: string,
  updates: UpdateListingRequest,
): Promise<ApiResponse<{ message: string; listingId: string }>> {
  return makeRequest<{ message: string; listingId: string }>(
    `/api/listings/${listingId}`,
    { method: "PUT", apiKey, body: updates },
  );
}

export async function deleteListing(
  apiKey: string,
  listingId: string,
): Promise<ApiResponse<{ message: string; listingId: string }>> {
  return makeRequest<{ message: string; listingId: string }>(
    `/api/listings/${listingId}`,
    { method: "DELETE", apiKey },
  );
}

export async function acceptOffer(
  apiKey: string,
  listingId: string,
  request: AcceptOfferRequest,
): Promise<ApiResponse<AcceptOfferResponse>> {
  return makeRequest<AcceptOfferResponse>(
    `/api/listings/${listingId}/offers/accept`,
    { method: "POST", apiKey, body: request },
  );
}

export async function getPendingOffers(
  apiKey: string,
  listingId: string,
): Promise<ApiResponse<PendingOffersResponse>> {
  return makeRequest<PendingOffersResponse>(
    `/api/listings/${listingId}/offers/pending`,
    { apiKey },
  );
}

export async function listDeals(
  apiKey: string,
): Promise<ApiResponse<DealsResponse>> {
  return makeRequest<DealsResponse>("/api/agents/deals", { apiKey });
}

export async function regenerateMagicLink(
  apiKey: string,
  chatId: string,
  message?: string,
): Promise<ApiResponse<MagicLinkResponse>> {
  return makeRequest<MagicLinkResponse>("/api/agents/deals", {
    method: "POST",
    apiKey,
    body: { chatId, message },
  });
}

export async function regenerateAllMagicLinks(
  apiKey: string,
  message?: string,
): Promise<ApiResponse<{ message: string; links: unknown[]; count: number; expiresIn: string }>> {
  return makeRequest<{ message: string; links: unknown[]; count: number; expiresIn: string }>(
    "/api/agents/deals/regenerate-all",
    { method: "POST", apiKey, body: message ? { message } : {} },
  );
}

export async function createMagicLink(
  apiKey: string,
  request: CreateMagicLinkRequest,
): Promise<ApiResponse<MagicLinkResponse>> {
  return makeRequest<MagicLinkResponse>("/api/magic-link", {
    method: "POST",
    apiKey,
    body: request,
  });
}
