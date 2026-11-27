import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { currentPromotionWhere, EffectivePriceService, promotionOrder } from '../stores/promotion.policy';
import { publicStoreSummarySelect } from '../stores/public-store.policy';
import { publicProductEligibilitySql, publicProductWhere } from './application/product.policy';
import { PublicProductsQueryDto } from './dto/public-products-query.dto';

const publicProductSelect = (now: Date) => ({
  id: true, name: true, description: true, price: true, stock: true,
  store: { select: publicStoreSummarySelect },
  category: { select: { id: true, name: true, slug: true, imageUrl: true } },
  images: {
    select: { url: true, altText: true, isCover: true },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  },
  promotions: {
    where: currentPromotionWhere(now), orderBy: promotionOrder, take: 1,
    select: { id: true, promotionalPrice: true, discountPercent: true, startAt: true, endAt: true, enabled: true },
  },
} satisfies Prisma.ProductSelect);
type PublicProductRow = Prisma.ProductGetPayload<{ select: ReturnType<typeof publicProductSelect> }>;

@Injectable()
export class PublicProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PublicProductsQueryDto = {}) {
    if (query.minPrice !== undefined && query.maxPrice !== undefined && new Prisma.Decimal(query.minPrice).gt(query.maxPrice)) {
      throw new BadRequestException('minPrice nao pode ser maior que maxPrice.');
    }
    const now = new Date();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const conditions: Prisma.Sql[] = [publicProductEligibilitySql];
    if (query.storeId) conditions.push(Prisma.sql`p.storeId = ${query.storeId}`);
    if (query.categoryId) conditions.push(Prisma.sql`p.categoryId = ${query.categoryId}`);
    if (query.q) {
      // LOCATE treats %, _ and backslashes as literal search characters.
      conditions.push(Prisma.sql`(LOCATE(${query.q}, p.name) > 0 OR LOCATE(${query.q}, p.description) > 0)`);
    }
    if (query.inStock !== undefined) conditions.push(query.inStock ? Prisma.sql`p.stock > 0` : Prisma.sql`p.stock = 0`);
    const effectivePrice = new EffectivePriceService().getEffectivePriceSql(
      Prisma.sql`p.price`, Prisma.sql`pr.promotionalPrice`, Prisma.sql`pr.discountPercent`, Prisma.sql`p.stock > 0 AND pr.id IS NOT NULL`,
    );
    const filters: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (query.minPrice !== undefined) filters.push(Prisma.sql`effectivePrice >= ${query.minPrice}`);
    if (query.maxPrice !== undefined) filters.push(Prisma.sql`effectivePrice <= ${query.maxPrice}`);
    if (query.onPromotion !== undefined) filters.push(query.onPromotion ? Prisma.sql`onPromotion = TRUE` : Prisma.sql`onPromotion = FALSE`);
    const needsPricing = query.minPrice !== undefined || query.maxPrice !== undefined || query.onPromotion !== undefined;
    const candidates = needsPricing ? Prisma.sql`
      current_promotions AS (
        SELECT promotion.id, promotion.productId, promotion.storeId,
          promotion.promotionalPrice, promotion.discountPercent,
          ROW_NUMBER() OVER (PARTITION BY promotion.productId, promotion.storeId
            ORDER BY promotion.startAt DESC, promotion.id DESC) AS priority
        FROM store_promotions promotion
        JOIN eligible product ON product.id = promotion.productId AND product.storeId = promotion.storeId
        WHERE promotion.enabled = TRUE AND promotion.startAt <= ${now} AND promotion.endAt > ${now}
      ), priced AS (
        SELECT p.id, p.createdAt, ${effectivePrice} AS effectivePrice,
          (p.stock > 0 AND pr.id IS NOT NULL) AS onPromotion
        FROM eligible p
        LEFT JOIN current_promotions pr ON pr.productId = p.id AND pr.storeId = p.storeId AND pr.priority = 1
      ), filtered AS (SELECT id, createdAt FROM priced WHERE ${Prisma.join(filters, ' AND ')})
    ` : Prisma.sql`filtered AS (SELECT id, createdAt FROM eligible)`;

    return this.prisma.$transaction(async (tx) => {
      // Count even empty pages, then hydrate only the requested public relationships.
      const rows = await tx.$queryRaw<{ id: string | null; total: bigint }[]>(Prisma.sql`
        WITH eligible AS (
          SELECT p.id, p.storeId, p.createdAt, p.price, p.stock
          FROM products p
          JOIN store_profiles s ON s.id = p.storeId
          JOIN product_categories c ON c.id = p.categoryId
          WHERE ${Prisma.join(conditions, ' AND ')}
        ), ${candidates}
        SELECT page.id, totals.total FROM (SELECT COUNT(*) AS total FROM filtered) totals
        LEFT JOIN (SELECT id, createdAt FROM filtered ORDER BY createdAt DESC, id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}) page ON TRUE
        ORDER BY page.createdAt DESC, page.id DESC
      `);
      const ids = rows.flatMap((row) => row.id === null ? [] : [row.id]);
      const products = ids.length ? await tx.product.findMany({
        where: { ...publicProductWhere, id: { in: ids } }, select: publicProductSelect(now),
      }) : [];
      const byId = new Map(products.map((product) => [product.id, product]));
      return { items: ids.map((id) => this.view(byId.get(id)!, now)), total: Number(rows[0].total), page, limit };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async get(id: string) {
    const now = new Date();
    const product = await this.prisma.product.findFirst({
      where: { ...publicProductWhere, id }, select: publicProductSelect(now),
    });
    if (!product) throw new NotFoundException('Produto nao encontrado.');
    return this.view(product, now);
  }

  private view(product: PublicProductRow, now: Date) {
    const active = product.stock > 0 ? product.promotions.find((promotion) =>
      promotion.enabled && promotion.startAt <= now && promotion.endAt > now) ?? null : null;
    const effectivePrice = new EffectivePriceService().getEffectivePrice(product.price, active, now, product.stock > 0);
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      basePrice: product.price.toFixed(2),
      effectivePrice: effectivePrice.toFixed(2),
      images: product.images,
      coverUrl: (product.images.find((image) => image.isCover) ?? product.images[0])?.url ?? null,
      store: product.store, category: product.category, stock: product.stock, inStock: product.stock > 0,
      onPromotion: active !== null,
      promotion: active ? {
        id: active.id, promotionalPrice: active.promotionalPrice?.toFixed(2) ?? null,
        discountPercent: active.discountPercent?.toFixed(2) ?? null, startAt: active.startAt, endAt: active.endAt,
      } : null,
    };
  }
}
