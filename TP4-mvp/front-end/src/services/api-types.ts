import type { ProductDetails } from "./store-products";

export type UserRole = "CLIENTE" | "PROFISSIONAL" | "LOJISTA" | "SUPORTE";
export type SelectableUserRole = Extract<UserRole, "CLIENTE" | "PROFISSIONAL" | "LOJISTA">;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

export type StoreDashboardSummary = {
  hasStore: boolean;
  activeProducts: number;
  lowStockProducts: number;
  activePromotions: number;
  ordersByStatus: Partial<Record<"PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELED", number>>;
  unreadMessages: number;
  latestOrder?: { id: string; status: string; total: string | number; createdAt: string; itemName: string | null } | null;
};
export type StoreIdentity = { name: string | null; status: string };
export type StoreDashboardList = "active-products" | "low-stock" | "promotions" | "orders" | "messages";
export type StoreReview = {
  id: string; storeId: string; rating: number; comment: string | null;
  createdAt: string; updatedAt: string; customer: { name: string };
};
export type StoreReviewsResponse = {
  items: StoreReview[]; total: number; page: number; limit: number;
  reputation: { averageRating: number | null; reviewCount: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> };
};
export type StoreOrderStatus = "PENDING" | "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELED";
export type DeliveryStatus = "PENDING" | "PREPARING" | "IN_TRANSIT" | "DELIVERED" | "FAILED" | "CANCELED";
export type StoreOrder = {
  store?: { id: string; name: string | null; whatsapp: string | null };
  id: string; orderNumber: string | null; status: StoreOrderStatus;
  customer: { id: string; name: string; phone: string | null } | null;
  addressSnapshot: { street?: string; number?: string; neighborhood?: string; city?: string; state?: string; zipCode?: string; complement?: string | null } | null;
  items: { id: string; name: string; sku: string | null; quantity: number; unitPrice: string; lineTotal: string | null }[];
  subtotal: string | null; discount: string; total: string; createdAt: string;
  delivery: { id: string; status: DeliveryStatus; trackingCode: string | null; carrier: string | null; estimatedDate: string | null; deliveredAt: string | null } | null;
  isDelayed: boolean;
  allowedActions: { orderStatuses: StoreOrderStatus[]; deliveryStatuses: DeliveryStatus[]; canEditDelivery: boolean };
  timeline: { id: string; kind: "ORDER" | "DELIVERY"; fromStatus: string | null; toStatus: string; actorId?: string | null; note: string | null; createdAt: string }[];
};
export type StoreOrdersFilters = { status?: StoreOrderStatus; group?: "OPEN" | "COMPLETED"; from?: string; to?: string; page?: number; limit?: number };
export type StoreOrderItemDetails = { item: StoreOrder["items"][number]; product: ProductDetails | null };

export type Category = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
};

export type ProfessionalProfile = {
  id: string;
  about?: string | null;
  dailyRate?: string | number | null;
  ratingAvg?: string | number | null;
  servicesDone: number;
  user: AuthUser;
  address?: {
    neighborhood: string;
    city: string;
    street?: string | null;
    number?: string | null;
  } | null;
  specialties: { category: Category }[];
  availability: { dayOfWeek: string; startTime: string; endTime: string }[];
  portfolio: {
    id: string;
    title: string;
    location: string;
    description?: string | null;
    images: { id: string; url: string; type: string; altText?: string | null }[];
  }[];
  reviews?: {
    id: string;
    rating: number;
    comment?: string | null;
    professionalReply?: string | null;
    repliedAt?: string | null;
    reportReason?: string | null;
    reportDetails?: string | null;
    reportedAt?: string | null;
    createdAt: string;
    client: { user: { id: string; name: string } };
  }[];
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type ServiceAdStatus =
  | "DRAFT"
  | "OPEN"
  | "PAUSED"
  | "CONTRACTED"
  | "CANCELED"
  | "EXPIRED";

export type ServiceAd = {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate?: string | null;
  startTime?: string | null;
  deadlineDays?: number | null;
  budget?: string | number | null;
  negotiable: boolean;
  status: ServiceAdStatus;
  visits: number;
  createdAt: string;
  category: Category;
  categories?: { category: Category }[];
  images: { id: string; url: string }[];
  applications?: Application[];
  client?: { user: AuthUser };
};

export type ApplicationStatus =
  | "SENT"
  | "COUNTER_OFFERED"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELED";

export type Application = {
  id: string;
  proposedValue?: string | number | null;
  message?: string | null;
  status: ApplicationStatus;
  createdAt: string;
  ad?: ServiceAd;
  professional: ProfessionalProfile;
};

export type DirectRequest = {
  id: string;
  title: string;
  description: string;
  location: string;
  startDate?: string | null;
  startTime?: string | null;
  deadlineDays?: number | null;
  budget?: string | number | null;
  status: "SENT" | "ACCEPTED" | "REJECTED" | "CANCELED" | "EXPIRED";
  client: { user: AuthUser };
  professional: ProfessionalProfile;
  images?: { id: string; url: string }[];
  conversations?: Conversation[];
};

export type ContractStatus =
  | "PENDING_START"
  | "IN_PROGRESS"
  | "WAITING_CLIENT_APPROVAL"
  | "COMPLETED"
  | "CANCELED"
  | "REOPENED";

export type Contract = {
  id: string;
  title: string;
  description: string;
  agreedValue?: string | number | null;
  startDate?: string | null;
  status: ContractStatus;
  client: { user: AuthUser };
  professional: ProfessionalProfile;
  ad?: (ServiceAd & { images: { id: string; url: string }[] }) | null;
  directRequest?: (DirectRequest & { images?: { id: string; url: string }[] }) | null;
  conversations?: Conversation[];
  review?: {
    id: string;
    rating: number;
    comment?: string | null;
    professionalReply?: string | null;
    repliedAt?: string | null;
    reportReason?: string | null;
    reportDetails?: string | null;
    reportedAt?: string | null;
  } | null;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
};

export type SupportTicket = {
  id: string;
  userId: string;
  subject: string;
  message: string;
  context?: string | null;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED";
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; email?: string; phone?: string | null; role: UserRole };
  _count?: { messages: number };
};
export type SupportMessage = {
  id: string; ticketId: string; actorId: string; type: "TEXT" | "IMAGE" | "AUDIO";
  text: string | null; imageUrl: string | null; audioUrl: string | null; durationMs: number | null;
  actor: { id: string; name: string; role: UserRole }; createdAt: string;
};
export type SupportAuditLog = {
  id: string; action: string; fromStatus: SupportTicket["status"] | null; toStatus: SupportTicket["status"] | null;
  note: string | null; actor: { id: string; name: string; role: UserRole }; createdAt: string;
};
export type SupportTicketDetail = SupportTicket & { user: NonNullable<SupportTicket["user"]>; messages: SupportMessage[]; auditLogs: SupportAuditLog[] };
export type SupportQueue = { items: SupportTicket[]; total: number; page: number; limit: number };

export type PortfolioProject = ProfessionalProfile["portfolio"][number];

export type UploadedImage = {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
};

export type UploadedAudio = UploadedImage;

export type MessageItem = {
  id: string;
  type: "TEXT" | "AUDIO" | "IMAGE";
  text?: string | null;
  audioUrl?: string | null;
  imageUrl?: string | null;
  durationMs?: number | null;
  readAt?: string | null;
  createdAt: string;
  sender: { id: string; name: string };
};

export type Conversation = {
  id: string;
  clientUserId: string;
  professionalUserId: string;
  contractId?: string | null;
  applicationId?: string | null;
  directRequestId?: string | null;
  clientUser: { id: string; name: string };
  professionalUser: { id: string; name: string };
  messages?: MessageItem[];
  createdAt: string;
  updatedAt: string;
};
