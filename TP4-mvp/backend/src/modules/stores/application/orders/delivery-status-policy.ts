import { DeliveryStatus, StoreOrderStatus } from '@prisma/client';

const transitions: Record<DeliveryStatus, DeliveryStatus[]> = {
  PENDING: ['PREPARING', 'CANCELED'],
  PREPARING: ['IN_TRANSIT', 'CANCELED'],
  IN_TRANSIT: ['DELIVERED', 'FAILED'],
  FAILED: ['IN_TRANSIT', 'CANCELED'],
  DELIVERED: [],
  CANCELED: [],
};

export function canTransitionDelivery(current: DeliveryStatus, target: DeliveryStatus, order: StoreOrderStatus) {
  if (!transitions[current].includes(target)) return false;
  if (target === DeliveryStatus.PREPARING) return order === StoreOrderStatus.PREPARING || order === StoreOrderStatus.READY;
  if (target === DeliveryStatus.IN_TRANSIT || target === DeliveryStatus.FAILED || target === DeliveryStatus.DELIVERED) return order === StoreOrderStatus.READY;
  return order !== StoreOrderStatus.COMPLETED && order !== StoreOrderStatus.CANCELED;
}
