import type { StoreProfile } from "./store-form";
import type { CatalogPage, ProductQuery, PublicProduct, PublicStore, PublicStoreDetail, StoreQuery } from "./public-catalog";
import type { ProductCategory, ProductFilters, ProductImage, ProductPage, ProductStatus, StoreProduct } from "./store-products";
import { request, toQuery } from "./api-core";
import { uploadStoreImage, uploadStoreProductImage } from "./api-uploads";
import type { DeliveryStatus, Paginated, StoreDashboardList, StoreDashboardSummary, StoreIdentity, StoreOrder, StoreOrderItemDetails, StoreOrdersFilters, StoreOrderStatus, StoreReviewsResponse } from "./api-types";

export const storeApi = {
  publicStores: (filters: StoreQuery = {}) => request<CatalogPage<PublicStore>>(`/stores${toQuery(filters)}`, { auth: false }),
  publicStore: (id: string) => request<PublicStoreDetail>(`/stores/${encodeURIComponent(id)}`, { auth: false }),
  publicProducts: (filters: ProductQuery = {}) => request<CatalogPage<PublicProduct>>(`/products${toQuery(filters)}`, { auth: false }),
  publicProduct: (id: string) => request<PublicProduct>(`/products/${encodeURIComponent(id)}`, { auth: false }),
  myStore: () => request<StoreProfile>("/stores/me"),
  storeIdentity: () => request<StoreIdentity>("/stores/me/identity"),
  saveMyStore: (input: unknown) => request<StoreProfile>("/stores/me", { method: "PUT", body: JSON.stringify(input) }),
  uploadStoreImage,
  storeActivationReadiness: () => request<{ allowed: boolean; pending: string[] }>("/stores/me/activation-readiness"),
  changeMyStoreStatus: (status: "ACTIVE" | "INACTIVE") => request<StoreProfile>("/stores/me/status", { method: "PATCH", body: JSON.stringify({ status }) }),
  storeDashboard: () => request<StoreDashboardSummary>("/stores/me/dashboard"),
  storeReviews: (page = 1, limit = 20) => request<StoreReviewsResponse>(`/stores/me/reviews${toQuery({ page, limit })}`),
  storeDashboardList: (kind: StoreDashboardList, status?: string) => request<unknown[]>(`/stores/me/dashboard/${kind}${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  storeOrders: (filters: { status?: StoreOrderStatus; from?: string; to?: string } = {}) => request<StoreOrder[]>(`/store-orders${toQuery(filters)}`),
  storeOrdersPage: (filters: StoreOrdersFilters = {}) => request<Paginated<StoreOrder>>(`/store-orders${toQuery({ ...filters, page: filters.page ?? 1, limit: filters.limit ?? 20 })}`),
  clientStoreOrders: (filters: StoreOrdersFilters = {}) => request<Paginated<StoreOrder>>(`/orders${toQuery({ ...filters, page: filters.page ?? 1, limit: filters.limit ?? 20 })}`),
  clientStoreOrder: (id: string) => request<StoreOrder>(`/orders/${encodeURIComponent(id)}`),
  storeOrderItem: (id: string, itemId: string) => request<StoreOrderItemDetails>(`/store-orders/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`),
  clientStoreOrderItem: (id: string, itemId: string) => request<StoreOrderItemDetails>(`/orders/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`),
  storeOrder: (id: string) => request<StoreOrder>(`/store-orders/${encodeURIComponent(id)}`),
  changeStoreOrderStatus: (id: string, status: StoreOrderStatus) => request<StoreOrder>(`/store-orders/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  upsertStoreOrderDelivery: (id: string, input: { trackingCode?: string; carrier?: string; estimatedDate?: string }) => request<StoreOrder>(`/store-orders/${encodeURIComponent(id)}/delivery`, { method: "PUT", body: JSON.stringify(input) }),
  changeStoreOrderDeliveryStatus: (id: string, status: DeliveryStatus) => request<StoreOrder>(`/store-orders/${encodeURIComponent(id)}/delivery/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  createStorePromotion: (input: { productId: string; promotionalPrice?: string; discountPercent?: string; startAt: string; endAt: string }) => request<Record<string, unknown>>("/stores/me/promotions", { method: "POST", body: JSON.stringify(input) }),
  updateStorePromotion: (id: string, input: { productId: string; promotionalPrice?: string; discountPercent?: string; startAt: string; endAt: string }) => request<Record<string, unknown>>(`/stores/me/promotions/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),
  setStorePromotionEnabled: (id: string, enabled: boolean) => request<Record<string, unknown>>(`/stores/me/promotions/${encodeURIComponent(id)}/enabled`, { method: "PATCH", body: JSON.stringify({ enabled }) }),
  productCategories: () => request<ProductCategory[]>("/product-categories", { auth: false }),
  storeProducts: (filters: Partial<ProductFilters> & { page?: number; limit?: number } = {}) =>
    request<ProductPage>(`/store-products${toQuery(filters as Record<string, string | number | undefined>)}`),
  storeProduct: (id: string) => request<StoreProduct>(`/store-products/${encodeURIComponent(id)}`),
  createStoreProduct: (input: unknown) => request<StoreProduct>("/store-products", { method: "POST", body: JSON.stringify(input) }),
  updateStoreProduct: (id: string, input: unknown) => request<StoreProduct>(`/store-products/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),
  updateStoreProductInventory: (id: string, input: { price?: string; stock?: number }) => request<StoreProduct>(`/store-products/${encodeURIComponent(id)}/inventory`, { method: "PATCH", body: JSON.stringify(input) }),
  setStoreProductStatus: (id: string, status: ProductStatus) => request<StoreProduct>(`/store-products/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  archiveStoreProduct: (id: string) => request<StoreProduct>(`/store-products/${encodeURIComponent(id)}`, { method: "DELETE" }),
  reorderStoreProductImages: (id: string, imageIds: string[]) => request<ProductImage[]>(`/store-products/${encodeURIComponent(id)}/images/order`, { method: "PATCH", body: JSON.stringify({ imageIds }) }),
  setStoreProductCover: (id: string, imageId: string) => request<ProductImage[]>(`/store-products/${encodeURIComponent(id)}/images/cover`, { method: "PATCH", body: JSON.stringify({ imageId }) }),
  removeStoreProductImage: (id: string, imageId: string) => request<void>(`/store-products/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}`, { method: "DELETE" }),
  uploadStoreProductImage,
};
