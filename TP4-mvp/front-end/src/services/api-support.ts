import { request, toQuery } from "./api-core";
import type { SupportMessage, SupportQueue, SupportTicket, SupportTicketDetail } from "./api-types";

export const supportApi = {
  createSupportTicket: (input: { subject: string; message: string; context?: string }) =>
    request<SupportTicket>("/support-tickets", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  mySupportTickets: () => request<SupportTicket[]>("/support-tickets/my"),
  supportQueue: (filters: { status?: SupportTicket["status"]; page?: number; limit?: number } = {}) => request<SupportQueue>(`/support-tickets${toQuery(filters)}`),
  supportTicket: (id: string) => request<SupportTicketDetail>(`/support-tickets/${encodeURIComponent(id)}`),
  sendSupportMessage: (id: string, input: { type: SupportMessage["type"]; text?: string; imageUrl?: string; audioUrl?: string; durationMs?: number }) => request<SupportMessage>(`/support-tickets/${encodeURIComponent(id)}/messages`, { method: "POST", body: JSON.stringify(input) }),
  updateSupportStatus: (id: string, status: SupportTicket["status"], note?: string) => request<SupportTicketDetail>(`/support-tickets/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status, note }) }),
  supportWhatsApp: (id: string) => request<{ url: string }>(`/support-tickets/${encodeURIComponent(id)}/whatsapp`, { method: "POST" }),
};
