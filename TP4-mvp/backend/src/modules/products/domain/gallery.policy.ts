import { GalleryError } from './gallery.error';

export const MAX_PRODUCT_IMAGES = 8;

export function assertCanAdd(count: number): void {
  if (count >= MAX_PRODUCT_IMAGES) throw new GalleryError('LIMIT');
}

export function assertExactOrder(currentIds: string[], requestedIds: string[]): void {
  if (currentIds.length !== requestedIds.length ||
      new Set(requestedIds).size !== currentIds.length ||
      requestedIds.some((id) => !currentIds.includes(id))) {
    throw new GalleryError('ORDER');
  }
}

export function coverAfterRemoval(images: Array<{ id: string; isCover: boolean }>, removedId: string): string | null {
  const removed = images.find((image) => image.id === removedId);
  if (!removed) throw new GalleryError('IMAGE_NOT_FOUND');
  const remaining = images.filter((image) => image.id !== removedId);
  return removed.isCover ? remaining[0]?.id ?? null : remaining.find((image) => image.isCover)?.id ?? remaining[0]?.id ?? null;
}
