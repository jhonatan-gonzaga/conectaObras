import { ContractStatus } from '@prisma/client';

export enum ContractActor {
  CLIENT = 'CLIENT',
  PROFESSIONAL = 'PROFESSIONAL',
}

export type ContractTransitionContext = {
  actor: ContractActor;
  targetStatus: ContractStatus;
  hasReview: boolean;
};

export type ContractStatusPolicyInput = ContractTransitionContext & {
  currentStatus: ContractStatus;
};

export interface ContractState {
  readonly status: ContractStatus;
  assertCanTransition(context: ContractTransitionContext): void;
}

export class ContractTransitionDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContractTransitionDeniedError';
  }
}

export abstract class BaseContractState implements ContractState {
  abstract readonly status: ContractStatus;

  abstract assertCanTransition(context: ContractTransitionContext): void;

  protected deny(actor: ContractActor): never {
    const message =
      actor === ContractActor.PROFESSIONAL
        ? 'Este status deve ser confirmado pelo cliente.'
        : 'Aguarde o profissional atualizar esta etapa do servico.';

    throw new ContractTransitionDeniedError(message);
  }
}
