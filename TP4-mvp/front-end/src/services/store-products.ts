export type ProductStatus = "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type StockFilter = "IN_STOCK" | "OUT_OF_STOCK";
export type ProductCategory = { id: string; name: string; slug: string; description?: string | null; imageUrl?: string | null };
export type ProductImage = { id: string; url: string; altText: string | null; position: number; isCover: boolean };
export type StoreProduct = {
  id: string; storeId: string; categoryId: string; sku: string | null; name: string;
  description: string | null; price: string; stock: number; status: ProductStatus;
  lastPriceUpdateAt: string; createdAt: string; updatedAt: string; images: ProductImage[];
  available?: boolean;
};
export type ProductPage = { items: StoreProduct[]; total: number; page: number; limit: number };
export type ProductFilters = { q: string; categoryId: string; status: ProductStatus | ""; stock: StockFilter | "" };
export type ProductForm = {
  name: string; price: string; stock: string; categoryId: string; sku: string; description: string;
  active: boolean;
};
export type ProductFormErrors = Partial<Record<"name" | "price" | "stock" | "categoryId" | "sku" | "description", string>>;

export const emptyProductForm = (): ProductForm => ({
  name: "", price: "", stock: "", categoryId: "", sku: "", description: "", active: false,
});

export function productToForm(product: StoreProduct): ProductForm {
  return {
    name: product.name, price: product.price.replace(".", ","), stock: String(product.stock),
    categoryId: product.categoryId, sku: product.sku ?? "", description: product.description ?? "",
    active: product.status === "ACTIVE",
  };
}

export function parseProductPrice(value: string): string | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(normalized)) return null;
  if (Number(normalized) <= 0) return null;
  const [whole, fraction = ""] = normalized.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

export function parseProductStock(value: string): number | null {
  const trimmed = value.trim();
  if (!/^(0|[1-9]\d*)$/.test(trimmed)) return null;
  const stock = Number(trimmed);
  return Number.isSafeInteger(stock) && stock <= 2_147_483_647 ? stock : null;
}

export function validateProductForm(form: ProductForm): ProductFormErrors {
  const errors: ProductFormErrors = {};
  if (!form.name.trim() || form.name.trim().length > 120) errors.name = "Informe um nome de até 120 caracteres.";
  if (!parseProductPrice(form.price)) errors.price = "Informe um preço positivo com até duas casas decimais.";
  if (parseProductStock(form.stock) === null) errors.stock = "Informe um estoque inteiro de 0 a 2.147.483.647.";
  if (!form.categoryId) errors.categoryId = "Selecione uma categoria.";
  if (form.sku.trim().length > 64) errors.sku = "Use até 64 caracteres.";
  if (form.description.length > 2000) errors.description = "Use até 2.000 caracteres.";
  return errors;
}

export function productPayload(form: ProductForm) {
  return {
    name: form.name.trim(), price: parseProductPrice(form.price)!, stock: parseProductStock(form.stock)!,
    categoryId: form.categoryId, sku: form.sku.trim() || undefined,
    description: form.description.trim() || undefined,
  };
}

export function inventoryPayload(price: string, stock: string, saved: StoreProduct) {
  const errors: Pick<ProductFormErrors, "price" | "stock"> = {};
  const normalizedPrice = parseProductPrice(price);
  const normalizedStock = parseProductStock(stock);
  if (!normalizedPrice) errors.price = "Informe um preço positivo com até duas casas decimais.";
  if (normalizedStock === null) errors.stock = "Informe um estoque inteiro não negativo.";
  if (Object.keys(errors).length) return { errors, payload: null };
  const payload: { price?: string; stock?: number } = {};
  if (normalizedPrice !== saved.price) payload.price = normalizedPrice!;
  if (normalizedStock !== saved.stock) payload.stock = normalizedStock!;
  return { errors, payload };
}

export function defaultProductFilter(product: StoreProduct) {
  return product.status !== "ARCHIVED";
}
