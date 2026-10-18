
import { StoreOrderStatus, UserRole } from '@prisma/client';

export interface OrderTransitionInput {
  currentStatus: StoreOrderStatus;
  targetStatus: StoreOrderStatus;
  actor: UserRole;
}


const allowedTransitions: Record<
  StoreOrderStatus,
  StoreOrderStatus[]
> = {
  PENDING: ['CONFIRMED', 'CANCELED'],
  CONFIRMED: ['PREPARING', 'CANCELED'],
  PREPARING: ['READY', 'CANCELED'],
  READY: ['COMPLETED', 'CANCELED'],
  COMPLETED: [],
  CANCELED: [],
};


export function canTransitionOrder({
  currentStatus,
  targetStatus,
  actor,
}: OrderTransitionInput): boolean {
  if (actor !== UserRole.LOJISTA) {
    return false;
  }

  return allowedTransitions[currentStatus].includes(targetStatus);
}