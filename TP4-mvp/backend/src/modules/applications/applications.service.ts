import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, NotificationType, ServiceAdStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { ContractCreationService } from '../contracts/contract-creation.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { ContractWithRelations } from '../contracts/contract.include';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly contractCreation: ContractCreationService,
  ) {}

  async create(userId: string, adId: string, dto: CreateApplicationDto) {
    const professional = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!professional) {
      throw new ForbiddenException('Perfil profissional nao cadastrado.');
    }

    const ad = await this.prisma.serviceAd.findUnique({
      where: { id: adId },
      include: { client: { include: { user: true } } },
    });

    if (!ad || ad.status !== ServiceAdStatus.OPEN) {
      throw new NotFoundException('Anuncio aberto nao encontrado.');
    }

    if (ad.client.userId === userId) {
      throw new BadRequestException('Voce nao pode se candidatar ao proprio anuncio.');
    }

    const application = await this.prisma.application.create({
      data: {
        adId,
        professionalId: professional.id,
        proposedValue: dto.proposedValue,
        message: dto.message,
        status: dto.proposedValue ? ApplicationStatus.COUNTER_OFFERED : ApplicationStatus.SENT,
      },
      include: { ad: true, professional: { include: { user: true } } },
    });

    await this.notifications.create({
      userId: ad.client.userId,
      type: NotificationType.APPLICATION_RECEIVED,
      title: 'Nova candidatura recebida',
      body: `${professional.user.name} se candidatou ao anuncio ${ad.title}.`,
      data: { adId, applicationId: application.id },
    });

    return application;
  }

  async findByAd(userId: string, adId: string) {
    const ad = await this.prisma.serviceAd.findUnique({
      where: { id: adId },
      include: { client: true },
    });

    if (!ad) {
      throw new NotFoundException('Anuncio nao encontrado.');
    }

    if (ad.client.userId !== userId) {
      throw new ForbiddenException('Anuncio pertence a outro cliente.');
    }

    return this.prisma.application.findMany({
      where: { adId },
      include: { professional: { include: { user: true, specialties: { include: { category: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMine(userId: string) {
    const professional = await this.prisma.professionalProfile.findUnique({
      where: { userId },
    });

    if (!professional) {
      throw new ForbiddenException('Perfil profissional nao cadastrado.');
    }

    return this.prisma.application.findMany({
      where: { professionalId: professional.id },
      include: { ad: { include: { category: true, client: { include: { user: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(userId: string, id: string, dto: UpdateApplicationDto) {
    const application = await this.getOwnApplication(userId, id);
    return this.prisma.application.update({
      where: { id: application.id },
      data: {
        proposedValue: dto.proposedValue,
        message: dto.message,
        status: dto.status,
      },
      include: { ad: true, professional: { include: { user: true } } },
    });
  }

  accept(userId: string, id: string): Promise<ContractWithRelations> {
    return this.contractCreation.acceptApplication(userId, id);
  }

  async reject(userId: string, id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: { ad: { include: { client: true } }, professional: true },
    });

    if (!application) {
      throw new NotFoundException('Candidatura nao encontrada.');
    }

    if (application.ad.client.userId !== userId) {
      throw new ForbiddenException('Somente o cliente dono do anuncio pode recusar.');
    }

    await this.notifications.create({
      userId: application.professional.userId,
      type: NotificationType.APPLICATION_REJECTED,
      title: 'Candidatura recusada',
      body: `Sua candidatura para ${application.ad.title} foi recusada.`,
      data: { applicationId: application.id, adId: application.adId },
    });

    return this.prisma.application.update({
      where: { id },
      data: { status: ApplicationStatus.REJECTED },
    });
  }

  private async getOwnApplication(userId: string, id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: { professional: true },
    });

    if (!application) {
      throw new NotFoundException('Candidatura nao encontrada.');
    }

    if (application.professional.userId !== userId) {
      throw new ForbiddenException('Candidatura pertence a outro profissional.');
    }

    return application;
  }
}
