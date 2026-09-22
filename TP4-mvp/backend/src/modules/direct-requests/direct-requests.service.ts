import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DirectRequestStatus, NotificationType, UserRole } from '@prisma/client';
import { optionalFutureDate } from '../../common/utils/date';
import { NotificationsService } from '../notifications/notifications.service';
import { ContractCreationService } from '../contracts/contract-creation.service';
import { ConversationsService } from '../conversations/conversations.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ContractWithRelations } from '../contracts/contract.include';
import { CreateDirectRequestDto } from './dto/create-direct-request.dto';

const directRequestInclude = {
  client: { include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } } },
  professional: {
    include: {
      user: { select: { id: true, name: true, phone: true, avatarUrl: true } },
      specialties: { include: { category: true } },
    },
  },
  contract: true,
  conversations: true,
  images: true,
};

@Injectable()
export class DirectRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly conversations: ConversationsService,
    private readonly contractCreation: ContractCreationService,
  ) {}

  async create(userId: string, dto: CreateDirectRequestDto) {
    const client = await this.ensureClientProfile(userId);
    const professional = await this.prisma.professionalProfile.findUnique({
      where: { id: dto.professionalId },
      include: { user: true },
    });

    if (!professional) {
      throw new NotFoundException('Profissional nao encontrado.');
    }

    if (professional.userId === userId) {
      throw new BadRequestException('Voce nao pode contratar diretamente seu proprio perfil.');
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.directRequest.create({
        data: {
          clientId: client.id,
          professionalId: professional.id,
          title: dto.title,
          description: dto.description,
          location: dto.location,
          startDate: optionalFutureDate(dto.startDate),
          startTime: dto.startTime,
          deadlineDays: dto.deadlineDays,
          budget: dto.budget,
          images: dto.imageUrls?.length
            ? { create: dto.imageUrls.map((url) => ({ url })) }
            : undefined,
        },
      });

      await this.conversations.create({
        clientUserId: userId,
        professionalUserId: professional.userId,
        directRequestId: request.id,
      }, tx);

      await this.notifications.create({
        userId: professional.userId,
        type: NotificationType.DIRECT_REQUEST_RECEIVED,
        title: 'Nova solicitacao direta',
        body: `Voce recebeu uma solicitacao para ${request.title}.`,
        data: { directRequestId: request.id },
      }, tx);

      return tx.directRequest.findUniqueOrThrow({
        where: { id: request.id },
        include: directRequestInclude,
      });
    });
  }

  async findMine(userId: string) {
    return this.prisma.directRequest.findMany({
      where: { client: { userId } },
      include: directRequestInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async inbox(userId: string) {
    return this.prisma.directRequest.findMany({
      where: { professional: { userId } },
      include: directRequestInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async inboxSummary(userId: string) {
    const pendingDirectRequests = await this.prisma.directRequest.count({
      where: { professional: { userId }, status: DirectRequestStatus.SENT },
    });
    return { pendingDirectRequests };
  }

  accept(userId: string, id: string): Promise<ContractWithRelations> {
    return this.contractCreation.acceptDirectRequest(userId, id);
  }

  async reject(userId: string, id: string) {
    const request = await this.getForProfessional(userId, id);
    await this.notifications.create({
      userId: request.client.userId,
      type: NotificationType.DIRECT_REQUEST_REJECTED,
      title: 'Solicitacao recusada',
      body: `Sua solicitacao ${request.title} foi recusada.`,
      data: { directRequestId: request.id },
    });
    return this.prisma.directRequest.update({
      where: { id },
      data: { status: DirectRequestStatus.REJECTED },
      include: directRequestInclude,
    });
  }

  async cancel(userId: string, id: string) {
    const request = await this.prisma.directRequest.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!request) {
      throw new NotFoundException('Solicitacao direta nao encontrada.');
    }

    if (request.client.userId !== userId) {
      throw new ForbiddenException('Solicitacao pertence a outro cliente.');
    }

    return this.prisma.directRequest.update({
      where: { id },
      data: { status: DirectRequestStatus.CANCELED },
      include: directRequestInclude,
    });
  }

  private async getForProfessional(userId: string, id: string) {
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

    return request;
  }

  private async ensureClientProfile(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.CLIENTE },
    });

    return this.prisma.clientProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }
}
