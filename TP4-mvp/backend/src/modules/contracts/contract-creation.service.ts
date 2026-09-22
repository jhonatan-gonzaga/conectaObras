import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, ContractStatus, DirectRequestStatus, NotificationType, Prisma, ServiceAdStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { NotificationsService } from '../notifications/notifications.service';

import { contractInclude, ContractWithRelations } from './contract.include';

type NewContractData = Pick<
  Prisma.ContractUncheckedCreateInput,
  'clientId' | 'professionalId' | 'adId' | 'applicationId' | 'directRequestId' |
  'title' | 'description' | 'agreedValue' | 'startDate'
>;

/** Fachada dos fluxos de contratacao; cada aceite conserva uma unica transacao. */
@Injectable()
export class ContractCreationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly conversations: ConversationsService,
  ) {}

  async acceptApplication(userId: string, id: string): Promise<ContractWithRelations> {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        professional: { include: { user: true } },
        ad: { include: { client: { include: { user: true } } } },
      },
    });

    if (!application) {
      throw new NotFoundException('Candidatura nao encontrada.');
    }

    if (application.ad.client.userId !== userId) {
      throw new ForbiddenException('Somente o cliente dono do anuncio pode aceitar.');
    }

    if (application.ad.status !== ServiceAdStatus.OPEN) {
      throw new BadRequestException('Este anuncio nao esta aberto para contratacao.');
    }

    const agreedValue = application.proposedValue ?? application.ad.budget;

    const contract = await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id },
        data: { status: ApplicationStatus.ACCEPTED },
      });
      await tx.application.updateMany({
        where: { adId: application.adId, id: { not: id } },
        data: { status: ApplicationStatus.REJECTED },
      });
      await tx.serviceAd.update({
        where: { id: application.adId },
        data: { status: ServiceAdStatus.CONTRACTED },
      });
      const created = await this.createContract(tx, {
        clientId: application.ad.clientId,
        professionalId: application.professionalId,
        adId: application.adId,
        applicationId: application.id,
        title: application.ad.title,
        description: application.ad.description,
        agreedValue,
        startDate: application.ad.startDate,
      });
      await this.conversations.create({
        clientUserId: application.ad.client.userId,
        professionalUserId: application.professional.userId,
        contractId: created.id,
        applicationId: application.id,
      }, tx);
      await this.notifications.create({
        userId: application.professional.userId,
        type: NotificationType.APPLICATION_ACCEPTED,
        title: 'Candidatura aceita',
        body: `Sua candidatura para ${application.ad.title} foi aceita.`,
        data: { contractId: created.id, applicationId: application.id },
      }, tx);
      return this.findCreatedContract(tx, created.id);
    });

    return contract;
  }

  async acceptDirectRequest(userId: string, id: string): Promise<ContractWithRelations> {
    const request = await this.prisma.directRequest.findUnique({
      where: { id },
      include: { client: true, professional: true },
    });

    if (!request) {
      throw new NotFoundException('Solicitacao direta nao encontrada.');
    }

    if (request.professional.userId !== userId) {
      throw new ForbiddenException('Solicitacao pertence a outro profissional.');
    }

    if (request.status !== DirectRequestStatus.SENT) {
      throw new BadRequestException('Solicitacao direta nao esta pendente.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.directRequest.update({
        where: { id },
        data: { status: DirectRequestStatus.ACCEPTED },
      });
      const contract = await this.createContract(tx, {
        clientId: request.clientId,
        professionalId: request.professionalId,
        directRequestId: request.id,
        title: request.title,
        description: request.description,
        agreedValue: request.budget,
        startDate: request.startDate,
      });
      await this.conversations.attachDirectRequestToContract(request.id, contract.id, tx);
      await this.notifications.create({
        userId: request.client.userId,
        type: NotificationType.DIRECT_REQUEST_ACCEPTED,
        title: 'Solicitacao aceita',
        body: `Sua solicitacao ${request.title} foi aceita.`,
        data: { directRequestId: request.id, contractId: contract.id },
      }, tx);
      return this.findCreatedContract(tx, contract.id);
    });
  }

  private async createContract(tx: Prisma.TransactionClient, data: NewContractData) {
    const contract = await tx.contract.create({
      data: { ...data, status: ContractStatus.PENDING_START },
    });
    await tx.contractStatusHistory.create({
      data: { contractId: contract.id, toStatus: ContractStatus.PENDING_START },
    });
    return contract;
  }

  private findCreatedContract(tx: Prisma.TransactionClient, id: string): Promise<ContractWithRelations> {
    return tx.contract.findUniqueOrThrow({ where: { id }, include: contractInclude });
  }
}
