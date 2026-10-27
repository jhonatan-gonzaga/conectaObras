import type { PublicProduct, PublicStoreDetail } from "../front-end/src/services/public-catalog";

export const publicStore: PublicStoreDetail = {
  id: "store-real-17", name: "Loja de teste", description: "Materiais para construção", logoUrl: null, coverUrl: null, backgroundUrl: null,
  phone: null, whatsapp: null, address: { street: "Rua A", number: "10", neighborhood: "Centro", city: "Itacoatiara", state: "AM", zipCode: "69100000", complement: null, latitude: null, longitude: null },
  openingHours: [{ dayOfWeek: "MONDAY", openingTime: "07:30", closingTime: "18:00", closed: false }, { dayOfWeek: "SUNDAY", openingTime: null, closingTime: null, closed: true }],
  timeZone: "America/Manaus", openNow: false,
  promotions: [{ id: "promo-1", productId: "product-real-23", productName: "Cimento de teste", promotionalPrice: "38.90", discountPercent: null, effectivePrice: "38.90", startAt: "2026-01-01T00:00:00Z", endAt: "2027-01-01T00:00:00Z" }],
};
export const publicProduct: PublicProduct = {
  id: "product-real-23", name: "Cimento de teste", description: "Descrição informada pela loja.", basePrice: "44.90", effectivePrice: "38.90",
  images: [], coverUrl: null, store: publicStore, category: { id: "category-real-12", name: "Materiais básicos", slug: "materiais" },
  stock: 48, inStock: true, onPromotion: true, promotion: publicStore.promotions[0],
};
