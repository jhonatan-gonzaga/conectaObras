import { Injectable } from '@nestjs/common';
import { ContractStatus } from '@prisma/client';
import { ContractState, ContractStatusPolicyInput } from './states/contract-state';
import { contractStates } from './states/contract-states';

@Injectable()
export class ContractStatusPolicyService {
  private readonly states = new Map<ContractStatus, ContractState>(
    contractStates.map((state) => [state.status, state]),
  );

  assertCanTransition({ currentStatus, ...context }: ContractStatusPolicyInput) {
    const state = this.states.get(currentStatus);

    if (!state) {
      throw new Error(`Politica nao configurada para o status ${currentStatus}.`);
    }

    state.assertCanTransition(context);
  }
}
