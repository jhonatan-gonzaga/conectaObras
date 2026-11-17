import { request, toQuery } from "./api-core";
import type { Application, Category, Contract, ContractStatus, Conversation, DirectRequest, MessageItem, NotificationItem, Paginated, PortfolioProject, ProfessionalProfile, ServiceAd, ServiceAdStatus } from "./api-types";

export const servicesApi = {
  categories: () => request<Category[]>("/categories", { auth: false }),
  professionals: (params: {
    q?: string;
    categoryId?: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
  } = {}) => request<Paginated<ProfessionalProfile>>(`/professionals${toQuery(params)}`, { auth: false }),
  professional: (id: string) =>
    request<ProfessionalProfile>(`/professionals/${id}`, { auth: false }),
  professionalMe: () => request<ProfessionalProfile>("/professionals/me"),
  upsertProfessionalMe: (input: unknown) =>
    request<ProfessionalProfile>("/professionals/me", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  myPortfolio: () => request<PortfolioProject[]>("/professionals/me/portfolio"),
  createPortfolio: (input: unknown) =>
    request<PortfolioProject>("/professionals/me/portfolio", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updatePortfolio: (id: string, input: unknown) =>
    request<PortfolioProject>(`/professionals/me/portfolio/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deletePortfolio: (id: string) =>
    request<{ deleted: true }>(`/professionals/me/portfolio/${id}`, {
      method: "DELETE",
    }),

  myServiceAds: () => request<Paginated<ServiceAd>>("/service-ads/my"),
  myServiceAdsSummary: () =>
    request<{ openAds: number; receivedApplications: number }>("/service-ads/my/summary"),
  openServiceAds: () => request<Paginated<ServiceAd>>("/service-ads/open"),
  serviceAdApplications: (adId: string) =>
    request<Application[]>(`/service-ads/${adId}/applications`),
  createServiceAd: (input: unknown) =>
    request<ServiceAd>("/service-ads", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateServiceAd: (id: string, input: unknown) =>
    request<ServiceAd>(`/service-ads/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  updateServiceAdStatus: (id: string, status: ServiceAdStatus) =>
    request<ServiceAd>(`/service-ads/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  dismissServiceAd: (id: string) =>
    request<{ dismissed: true }>(`/service-ads/${id}/dismiss`, { method: "POST" }),
  deleteServiceAd: (id: string) =>
    request<{ deleted: true }>(`/service-ads/${id}`, { method: "DELETE" }),

  createApplication: (adId: string, input: { proposedValue?: number; message?: string }) =>
    request<Application>(`/service-ads/${adId}/applications`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  myApplications: () => request<Application[]>("/applications/my"),
  acceptApplication: (id: string) =>
    request<Contract>(`/applications/${id}/accept`, { method: "POST" }),
  rejectApplication: (id: string) =>
    request<Application>(`/applications/${id}/reject`, { method: "POST" }),

  createDirectRequest: (input: unknown) =>
    request<DirectRequest>("/direct-requests", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  myDirectRequests: () => request<DirectRequest[]>("/direct-requests/my"),
  inboxDirectRequests: () => request<DirectRequest[]>("/direct-requests/inbox"),
  inboxDirectRequestsSummary: () =>
    request<{ pendingDirectRequests: number }>("/direct-requests/inbox/summary"),
  acceptDirectRequest: (id: string) =>
    request<Contract>(`/direct-requests/${id}/accept`, { method: "POST" }),
  rejectDirectRequest: (id: string) =>
    request<DirectRequest>(`/direct-requests/${id}/reject`, { method: "POST" }),

  myContracts: () => request<Contract[]>("/contracts/my"),
  contract: (id: string) => request<Contract>(`/contracts/${id}`),
  updateContractStatus: (id: string, status: ContractStatus, note?: string) =>
    request<Contract>(`/contracts/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, note }),
    }),
  createReview: (id: string, input: { rating: number; comment?: string }) =>
    request(`/contracts/${id}/review`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  replyReview: (id: string, input: { reply: string }) =>
    request(`/contracts/reviews/${id}/reply`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  reportReview: (id: string, input: { reason: string; details: string }) =>
    request(`/contracts/reviews/${id}/report`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  conversations: () => request<Conversation[]>("/conversations"),
  unreadConversations: () => request<{ count: number }>("/conversations/unread-count"),
  conversationMessages: (id: string) =>
    request<MessageItem[]>(`/conversations/${id}/messages`),
  sendMessage: (
    id: string,
    input:
      | { type?: "TEXT"; text: string }
      | { type: "AUDIO"; audioUrl: string; durationMs?: number }
      | { type: "IMAGE"; imageUrl: string },
  ) =>
    request<MessageItem>(`/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  notifications: () => request<NotificationItem[]>("/notifications"),
  unreadNotifications: () => request<{ count: number }>("/notifications/unread-count"),
};
