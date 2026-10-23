
import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { StoreOrderStatus, UserRole } from '@prisma/client';
import { canTransitionOrder } from '../src/modules/stores/application/orders/order-status-policy';

describe('OrderStatusPolicy', () => {
  it('deve permitir que o lojista confirme um pedido pendente', () => {
    const resultado = canTransitionOrder({
      currentStatus: StoreOrderStatus.PENDING,
      targetStatus: StoreOrderStatus.CONFIRMED,
      actor: UserRole.LOJISTA,
    });

    assert.equal(resultado, true);
  });

  it('deve validar todas as transições de status do lojista', () => {
    const transicoesPermitidas: Record<
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

    const todosOsStatus = Object.values(StoreOrderStatus);

    for (const origem of todosOsStatus) {
      for (const destino of todosOsStatus) {
        const esperado = transicoesPermitidas[origem].includes(destino);

        const resultado = canTransitionOrder({
          currentStatus: origem,
          targetStatus: destino,
          actor: UserRole.LOJISTA,
        });

        assert.equal(
          resultado,
          esperado,
          `Transição ${origem} → ${destino}`,
        );
      }
    }
  });

    it('deve impedir transições realizadas por outros atores', () => {
        const atoresNaoPermitidos = [
            UserRole.CLIENTE,
            UserRole.PROFISSIONAL,
            UserRole.SUPORTE,
        ];

        const todosOsStatus = Object.values(StoreOrderStatus);

        for (const actor of atoresNaoPermitidos) {
            for (const origem of todosOsStatus) {
            for (const destino of todosOsStatus) {
                const resultado = canTransitionOrder({
                currentStatus: origem,
                targetStatus: destino,
                actor,
                });

                assert.equal(
                resultado,
                false,
                `${actor}: ${origem} → ${destino}`,
                );
            }
            }
        }
    });
});
