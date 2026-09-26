import { StoreStatus } from '@prisma/client';
import { UpsertMyStoreDto } from '../dto/upsert-my-store.dto';

export type StoreRecord = {
  id: string;
  ownerId: string;
  name: string | null;
  cnpj: string | null;
  description: string | null;
  phone: string | null;
  whatsapp: string | null;
  logoUrl: string | null;
  status: StoreStatus;
  address: {
    street: string | null;
    number: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    complement: string | null;
  } | null;
  openingHours: Array<{
    dayOfWeek: string;
    openingTime: string | null;
    closingTime: string | null;
    closed: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
};

export interface StoreRepository {
  findByOwner(ownerId: string): Promise<StoreRecord | null>;
  upsertProfile(ownerId: string, dto: UpsertMyStoreDto): Promise<StoreRecord>;
  changeStatus(ownerId: string, status: StoreStatus): Promise<StoreRecord>;
  updateLogo(ownerId: string, logoUrl: string): Promise<StoreRecord>;
}

export const STORE_REPOSITORY = Symbol('STORE_REPOSITORY');
