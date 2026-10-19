import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateStorePromotionDto } from './dto/create-store-promotion.dto';

const include = { product: { select: { id: true, name: true, price: true, sku: true, stock: true, status: true, images: { orderBy: { position: 'asc' as const } } } } };

@Injectable()
export class StorePromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async storeId(ownerId: string) {
    const store = await this.prisma.storeProfile.findUnique({ where: { ownerId }, select: { id: true } });
    if (!store) throw new NotFoundException('Loja não encontrada.');
    return store.id;
  }

  async list(ownerId: string) {
    const storeId = await this.storeId(ownerId);
    return this.prisma.storePromotion.findMany({ where: { storeId }, include, orderBy: { createdAt: 'desc' } });
  }

  async find(ownerId: string, id: string) {
    const storeId = await this.storeId(ownerId);
    const promotion = await this.prisma.storePromotion.findFirst({ where: { id, storeId }, include });
    if (!promotion) throw new NotFoundException('Promoção não encontrada.');
    return promotion;
  }

  async save(ownerId: string, dto: CreateStorePromotionDto, id?: string) {
    const storeId = await this.storeId(ownerId);
    return this.prisma.$transaction(async (tx) => {
      // Serialize campaign writes for this store before checking overlapping periods.
      await tx.$queryRaw`SELECT id FROM store_profiles WHERE id = ${storeId} FOR UPDATE`;
      if (id && !await tx.storePromotion.findFirst({ where: { id, storeId } })) throw new NotFoundException('Promoção não encontrada.');
      const data = await this.validate(tx, storeId, dto, id);
      return id
        ? tx.storePromotion.update({ where: { id }, data, include })
        : tx.storePromotion.create({ data: { ...data, storeId }, include });
    });
  }

  async changeStatus(ownerId: string, id: string, status: 'ACTIVE' | 'CANCELED') {
    const storeId = await this.storeId(ownerId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM store_profiles WHERE id = ${storeId} FOR UPDATE`;
      const saved = await tx.storePromotion.findFirst({ where: { id, storeId } });
      if (!saved) throw new NotFoundException('Promoção não encontrada.');
      if (status === 'ACTIVE') {
        if (!saved.productId || !saved.startsAt || !saved.endsAt) throw new BadRequestException('Edite o produto e a vigência antes de ativar.');
        await this.validate(tx, storeId, {
          name: saved.name, productId: saved.productId, discountType: saved.discountType,
          discountValue: Number(saved.discountValue), startsAt: saved.startsAt.toISOString(), endsAt: saved.endsAt.toISOString(), status,
        }, id);
      }
      return tx.storePromotion.update({ where: { id }, data: { status }, include });
    });
  }

  private async validate(tx: Prisma.TransactionClient, storeId: string, dto: CreateStorePromotionDto, id?: string) {
    const product = await tx.product.findFirst({ where: { id: dto.productId, storeId, status: 'ACTIVE' } });
    if (!product) throw new BadRequestException('Selecione um produto ativo da sua loja.');
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) throw new BadRequestException('O término deve ser posterior ao início.');
    if (dto.status === 'ACTIVE' && endsAt <= new Date()) throw new BadRequestException('Atualize a vigência antes de publicar uma promoção expirada.');
    if (!dto.name.trim() || dto.name.trim().length > 120 || !Number.isFinite(dto.discountValue) || dto.discountValue <= 0) throw new BadRequestException('Informe o nome e um desconto válido.');
    const value = new Prisma.Decimal(dto.discountValue);
    const price = new Prisma.Decimal(product.price);
    if (dto.discountType === 'PERCENTAGE' && value.gte(100)) throw new BadRequestException('O percentual deve ser menor que 100%.');
    const finalPrice = (dto.discountType === 'PERCENTAGE' ? price.mul(new Prisma.Decimal(100).sub(value)).div(100)
      : dto.discountType === 'FIXED' ? price.sub(value) : value).toDecimalPlaces(2);
    if (finalPrice.lte(0) || finalPrice.gte(price)) throw new BadRequestException('O preço final deve ser positivo e menor que o preço de tabela.');
    if (dto.status === 'ACTIVE' && await tx.storePromotion.findFirst({ where: {
      storeId, productId: dto.productId, status: 'ACTIVE', ...(id ? { id: { not: id } } : {}),
      AND: [{ OR: [{ startsAt: null }, { startsAt: { lt: endsAt } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }] }],
    } })) throw new ConflictException('Já existe uma promoção ativa ou agendada para este produto nesse período.');
    return {
      name: dto.name.trim(), productId: dto.productId, discountType: dto.discountType, discountValue: value,
      discountPct: price.sub(finalPrice).div(price).mul(100).toDecimalPlaces(2), startsAt, endsAt, status: dto.status,
    };
  }
}
