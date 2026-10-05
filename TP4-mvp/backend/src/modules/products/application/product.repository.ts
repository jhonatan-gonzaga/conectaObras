export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface ProductImageInput {
  url: string;
  objectKey?: string;
  altText?: string;
  position: number;
  isCover?: boolean;
}

export interface CreateProductInput {
  categoryId: string;
  sku?: string | null;
  name: string;
  description?: string;
  price: string;
  stock: number;
  images?: ProductImageInput[];
}

export type UpdateProductInput = Partial<Omit<CreateProductInput, 'images'>>;

export interface ProductListQuery {
  page: number;
  limit: number;
  q?: string;
  categoryId?: string;
  status?: ProductStatus;
  stock?: 'IN_STOCK' | 'OUT_OF_STOCK';
}

export interface ProductPage {
  items: ProductRecord[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductRecord {
  id: string;
  storeId: string;
  categoryId: string;
  sku: string | null;
  name: string;
  description: string | null;
  price: string;
  stock: number;
  status: ProductStatus;
  lastPriceUpdateAt: Date;
  createdAt: Date;
  updatedAt: Date;
  images: Array<{
    id: string;
    url: string;
    objectKey: string | null;
    altText: string | null;
    position: number;
    isCover: boolean;
  }>;
}

// storeId must come from the authenticated owner's store, never an HTTP body.
export abstract class ProductRepository {
  abstract create(storeId: string, input: CreateProductInput): Promise<ProductRecord>;
  abstract findByStore(storeId: string, productId: string): Promise<ProductRecord | null>;
  abstract listByStore(storeId: string, status?: ProductStatus): Promise<ProductRecord[]>;
  abstract listPage(storeId: string, query: ProductListQuery): Promise<ProductPage>;
  abstract categoryIsActive(categoryId: string): Promise<boolean>;
  abstract update(storeId: string, productId: string, currentStatus: ProductStatus, input: UpdateProductInput, priceChanged: boolean): Promise<boolean>;
  abstract changeStatus(storeId: string, productId: string, currentStatus: ProductStatus, status: ProductStatus): Promise<boolean>;
  abstract archive(storeId: string, productId: string): Promise<boolean>;
  abstract updatePrice(storeId: string, productId: string, price: string): Promise<boolean>;
}
