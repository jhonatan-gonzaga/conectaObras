import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryStatus, Prisma, StoreOrderStatus } from '@prisma/client';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStoreReviewDto } from './dto/create-store-review.dto';
import { publicStoreWhere } from './public-store.policy';

const reviewSelect = {
  id: true, storeId: true, rating: true, comment: true, createdAt: true, updatedAt: true,
  customer: { select: { name: true } },
} satisfies Prisma.StoreReviewSelect;

@Injectable()
export class StoreReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(customerId: string, orderId: string, dto: CreateStoreReviewDto) {
    if (!Number.isInteger(dto.rating) || dto.rating < 1 || dto.rating > 5) {
      throw new BadRequestException('A nota deve ser um inteiro de 1 a 5.');
    }
    if (dto.comment != null && (typeof dto.comment !== 'string' || dto.comment.length > 2000)) {
      throw new BadRequestException('O comentario deve ter ate 2000 caracteres.');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const order = await tx.storeOrder.findFirst({
          where: { id: orderId, customerId },
          select: { id: true, storeId: true, status: true, delivery: { select: { status: true } } },
        });
        if (!order) throw new NotFoundException('Pedido nao encontrado.');
        // The delivery owns DELIVERED; the existing order flow then sets COMPLETED.
        if (order.status !== StoreOrderStatus.COMPLETED || order.delivery?.status !== DeliveryStatus.DELIVERED) {
          throw new BadRequestException('Somente pedidos com entrega DELIVERED e status COMPLETED podem ser avaliados.');
        }
        return tx.storeReview.create({
          data: { orderId: order.id, storeId: order.storeId, customerId, rating: dto.rating, comment: dto.comment?.trim() || null },
          select: reviewSelect,
        });
      });
    } catch (error) {
      // The unique orderId also protects simultaneous submissions.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Este pedido ja possui uma avaliacao.');
      }
      throw error;
    }
  }

  async listPublic(storeId: string, query: PaginationQueryDto = {}) {
    const store = await this.prisma.storeProfile.findFirst({ where: { ...publicStoreWhere, id: storeId }, select: { id: true } });
    if (!store) throw new NotFoundException('Loja nao encontrada.');
    return this.list(store.id, query);
  }

  async listMine(ownerId: string, query: PaginationQueryDto = {}) {
    const store = await this.prisma.storeProfile.findUnique({ where: { ownerId }, select: { id: true } });
    if (!store) throw new NotFoundException('Loja nao encontrada.');
    return this.list(store.id, query);
  }

  private async list(storeId: string, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.prisma.$transaction(async (tx) => {
      const where = { storeId };
      const [items, aggregate, groups] = await Promise.all([
        tx.storeReview.findMany({ where, select: reviewSelect, skip: (page - 1) * limit, take: limit, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
        tx.storeReview.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
        tx.storeReview.groupBy({ by: ['rating'], where, _count: { _all: true } }),
      ]);
      const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const group of groups) distribution[group.rating] = group._count._all;
      return {
        items, total: aggregate._count._all, page, limit,
        reputation: { averageRating: aggregate._avg.rating, reviewCount: aggregate._count._all, distribution },
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
