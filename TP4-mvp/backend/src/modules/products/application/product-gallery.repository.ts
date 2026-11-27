export interface GalleryImage {
  id: string;
  url: string;
  altText: string | null;
  position: number;
  isCover: boolean;
}

export interface StoredProductImage {
  url: string;
  objectKey: string;
  altText: string | null;
}

export abstract class ProductGalleryRepository {
  abstract assertWritable(ownerId: string, productId: string): Promise<void>;
  abstract add(ownerId: string, productId: string, image: StoredProductImage): Promise<GalleryImage>;
  abstract reorder(ownerId: string, productId: string, imageIds: string[]): Promise<GalleryImage[]>;
  abstract setCover(ownerId: string, productId: string, imageId: string): Promise<GalleryImage[]>;
  abstract remove(ownerId: string, productId: string, imageId: string): Promise<string | null>;
}
