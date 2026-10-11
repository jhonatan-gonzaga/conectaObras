import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { StoreImageKind, StoreRecord, StoreRepository } from '../application/store.repository';
import { StoreAddressDto, UpsertMyStoreDto } from '../dto/upsert-my-store.dto';
import { validateOpeningHours, validatePersistedStore } from '../store-persistence.validation';

export const storeDetailSelect = {
  id: true,
  ownerId: true,
  name: true,
  cnpj: true,
  description: true,
  phone: true,
  whatsapp: true,
  logoUrl: true,
  backgroundUrl: true,
  status: true,
  address: true,
  openingHours: { orderBy: { dayOfWeek: 'asc' } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StoreProfileSelect;

@Injectable()
export class PrismaStoreRepository implements StoreRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOwner(ownerId: string): Promise<StoreRecord | null> {
    return this.prisma.storeProfile.findUnique({
      where: { ownerId },
      select: storeDetailSelect,
    }) as Promise<StoreRecord | null>;
  }

  async upsertProfile(ownerId: string, dto: UpsertMyStoreDto): Promise<StoreRecord> {
    if (dto.openingHours) validateOpeningHours(dto.openingHours);
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const store = await transaction.storeProfile.upsert({
          where: { ownerId },
          create: { ownerId, ...this.storeData(dto) },
          update: this.storeData(dto),
          select: { id: true },
        });

        if (dto.address) {
          await transaction.storeAddress.upsert({
            where: { storeId: store.id },
            create: { storeId: store.id, ...this.addressData(dto.address) },
            update: this.addressData(dto.address),
          });
        }

        if (dto.openingHours) {
          await transaction.storeOpeningHour.deleteMany({ where: { storeId: store.id } });
          if (dto.openingHours.length) {
            await transaction.storeOpeningHour.createMany({
              data: dto.openingHours.map((hours) => ({
                storeId: store.id,
                dayOfWeek: hours.dayOfWeek,
                openingTime: hours.openingTime,
                closingTime: hours.closingTime,
                closed: hours.closed,
              })),
            });
          }
        }

        const result = await transaction.storeProfile.findUniqueOrThrow({
          where: { id: store.id },
          select: storeDetailSelect,
        });
        validatePersistedStore(result);
        return result as StoreRecord;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('CNPJ ja cadastrado.');
      }
      throw error;
    }
  }

  async changeStatus(ownerId: string, status: StoreRecord['status']): Promise<StoreRecord> {
    return this.prisma.storeProfile.update({
      where: { ownerId },
      data: { status },
      select: storeDetailSelect,
    }) as Promise<StoreRecord>;
  }

  async updateImage(ownerId: string, kind: StoreImageKind, url: string): Promise<StoreRecord> {
    return this.prisma.storeProfile.update({
      where: { ownerId },
      data: kind === 'background' ? { backgroundUrl: url } : { logoUrl: url },
      select: storeDetailSelect,
    }) as Promise<StoreRecord>;
  }

  private storeData(dto: UpsertMyStoreDto) {
    return {
      name: dto.name,
      cnpj: this.normalizeDigits(dto.cnpj, 14, 'CNPJ'),
      description: dto.description,
      phone: dto.phone,
      whatsapp: dto.whatsapp,
    };
  }

  private addressData(address: StoreAddressDto) {
    return {
      street: address.street,
      number: address.number,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state?.toUpperCase(),
      zipCode: this.normalizeDigits(address.zipCode, 8, 'CEP'),
      complement: address.complement,
      latitude: address.latitude,
      longitude: address.longitude,
    };
  }

  private normalizeDigits(value: string | null | undefined, length: number, field: string) {
    if (value === undefined || value === null) return value;
    if (!value.trim()) return null;
    const digits = value.replace(/\D/g, '');
    if (digits.length !== length) {
      throw new BadRequestException(`${field} deve conter ${length} digitos.`);
    }
    return digits;
  }
}
