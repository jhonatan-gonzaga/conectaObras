import { ProductRecord, ProductStatus } from './product.repository';

export const MAX_PRODUCT_STOCK = 2_147_483_647;

export function activationPending(product: ProductRecord, categoryActive: boolean): string[] {
  const pending: string[] = [];
  if (!product.name.trim()) pending.push('NAME_REQUIRED');
  if (!product.categoryId || !categoryActive) pending.push('ACTIVE_CATEGORY_REQUIRED');
  if (!/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/.test(product.price) || Number(product.price) <= 0) {
    pending.push('PRICE_REQUIRED');
  }
  if (!Number.isInteger(product.stock) || product.stock < 0) pending.push('STOCK_REQUIRED');
  if (!product.images.some((image) => image.isCover)) pending.push('COVER_IMAGE_REQUIRED');
  return pending;
}

export function canChangeProductStatus(current: ProductStatus, target: ProductStatus): boolean {
  if (target === 'ARCHIVED') return false;
  if (current === 'ARCHIVED') return target === 'ACTIVE' || target === 'INACTIVE';
  if (current === target) return true;
  if (current === 'DRAFT') return target === 'ACTIVE' || target === 'INACTIVE';
  return target === 'ACTIVE' || target === 'INACTIVE';
}
