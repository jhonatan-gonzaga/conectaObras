import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StoreAddressDto, UpsertMyStoreDto } from './dto/upsert-my-store.dto';

export const storeDetailSelect = {
  id: true,
  name: true,
  cnpj: true,
  description: true,
  phone: true,
  whatsapp: true,
  logoUrl: true,
  status: true,
  address: true,
  openingHours: {
    orderBy: { dayOfWeek: 'asc' },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StoreProfileSelect;

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(userId: string) {
    const store = await this.prisma.storeProfile.findUnique({
      where: { ownerId: userId },
      select: storeDetailSelect,
    });

    if (!store) {
      throw new NotFoundException('Loja nao encontrada.');
    }

    return store;
  }

  async upsertMine(userId: string, dto: UpsertMyStoreDto) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const store = await transaction.storeProfile.upsert({
          where: { ownerId: userId },
          create: {
            ownerId: userId,
            ...this.storeData(dto),
          },
          update: this.storeData(dto),
          select: { id: true },
        });

        if (dto.address) {
          await transaction.storeAddress.upsert({
            where: { storeId: store.id },
            create: {
              storeId: store.id,
              ...this.addressData(dto.address),
            },
            update: this.addressData(dto.address),
          });
        }

        if (dto.openingHours) {
          await transaction.storeOpeningHour.deleteMany({
            where: { storeId: store.id },
          });

          if (dto.openingHours.length) {
            await transaction.storeOpeningHour.createMany({
              data: dto.openingHours.map((openingHour) => ({
                storeId: store.id,
                dayOfWeek: openingHour.dayOfWeek,
                openingTime: openingHour.openingTime,
                closingTime: openingHour.closingTime,
                closed: openingHour.closed,
              })),
            });
          }
        }

        return transaction.storeProfile.findUniqueOrThrow({
          where: { id: store.id },
          select: storeDetailSelect,
        });
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('CNPJ ja cadastrado.');
      }

      throw error;
    }
  }

  private storeData(dto: UpsertMyStoreDto) {
    return {
      name: dto.name,
      cnpj: dto.cnpj === undefined ? undefined : this.onlyDigits(dto.cnpj),
      description: dto.description,
      phone: dto.phone,
      whatsapp: dto.whatsapp,
    };
  }

  private addressData(dto: StoreAddressDto) {
    return {
      street: dto.street,
      number: dto.number,
      neighborhood: dto.neighborhood,
      city: dto.city,
      state: dto.state?.toUpperCase(),
      zipCode: dto.zipCode === undefined ? undefined : this.onlyDigits(dto.zipCode),
      complement: dto.complement,
    };
  }

  private onlyDigits(value: string) {
    return value.replace(/\D/g, '');
  }

  private isUniqueConstraintError(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
