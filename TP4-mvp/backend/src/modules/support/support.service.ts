import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { MessageType, Prisma, SupportTicketStatus, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { SupportQueueQueryDto } from './dto/support-queue-query.dto';
import { UpdateSupportStatusDto } from './dto/update-support-status.dto';

const userSelect = { id: true, name: true, email: true, phone: true, role: true } as const;
const detailInclude = {
  user: { select: userSelect },
  messages: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, name: true, role: true } } } },
  auditLogs: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, name: true, role: true } } } },
} satisfies Prisma.SupportTicketInclude;

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  createTicket(userId: string, dto: CreateSupportTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        userId,
        subject: dto.subject.trim(),
        message: dto.message.trim(),
        context: dto.context?.trim(),
        auditLogs: { create: { actorId: userId, action: 'CREATED' } },
      },
    });
  }

  findMine(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async queue(query: SupportQueueQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.SupportTicketWhereInput = query.status ? { status: query.status } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        include: { user: { select: { id: true, name: true, role: true } }, _count: { select: { messages: true } } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async detail(actor: AuthenticatedUser, id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, include: detailInclude });
    if (!ticket || (actor.role !== UserRole.SUPORTE && ticket.userId !== actor.id)) {
      throw new NotFoundException('Chamado nao encontrado.');
    }
    return ticket;
  }

  async sendMessage(actor: AuthenticatedUser, id: string, dto: CreateSupportMessageDto, origin: string) {
    const ticket = await this.detail(actor, id);
    if (ticket.status === SupportTicketStatus.RESOLVED) throw new ConflictException('Reabra o chamado para enviar mensagens.');
    const content = this.messageContent(dto, origin);
    return this.prisma.$transaction(async (tx) => {
      const active = await tx.supportTicket.updateMany({ where: { id, status: { not: SupportTicketStatus.RESOLVED } }, data: { updatedAt: new Date() } });
      if (!active.count) throw new ConflictException('Reabra o chamado para enviar mensagens.');
      const message = await tx.supportMessage.create({
        data: { ticketId: id, actorId: actor.id, type: dto.type, ...content },
        include: { actor: { select: { id: true, name: true, role: true } } },
      });
      await tx.supportAuditLog.create({ data: { ticketId: id, actorId: actor.id, action: 'MESSAGE_SENT', note: dto.type } });
      return message;
    });
  }

  async changeStatus(actorId: string, id: string, dto: UpdateSupportStatusDto) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!ticket) throw new NotFoundException('Chamado nao encontrado.');
    const allowed: Record<SupportTicketStatus, SupportTicketStatus[]> = {
      OPEN: [SupportTicketStatus.IN_REVIEW],
      IN_REVIEW: [SupportTicketStatus.OPEN, SupportTicketStatus.RESOLVED],
      RESOLVED: [SupportTicketStatus.IN_REVIEW],
    };
    if (!allowed[ticket.status].includes(dto.status)) throw new ConflictException('Transicao de status invalida.');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.supportTicket.updateMany({ where: { id, status: ticket.status }, data: { status: dto.status } });
      if (!updated.count) throw new ConflictException('O chamado mudou. Atualize a tela.');
      await tx.supportAuditLog.create({
        data: { ticketId: id, actorId, action: 'STATUS_CHANGED', fromStatus: ticket.status, toStatus: dto.status, note: dto.note?.trim() || null },
      });
      return tx.supportTicket.findUniqueOrThrow({ where: { id }, include: detailInclude });
    });
  }

  async transferToWhatsApp(actorId: string, id: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id }, include: { user: { select: { phone: true } } } });
    if (!ticket) throw new NotFoundException('Chamado nao encontrado.');
    if (ticket.status === SupportTicketStatus.RESOLVED) throw new ConflictException('Reabra o chamado antes de mudar de canal.');
    const digits = ticket.user.phone?.replace(/\D/g, '') ?? '';
    const phone = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
    if (!/^\d{12,13}$/.test(phone)) throw new BadRequestException('O usuario nao possui telefone valido para WhatsApp.');
    await this.prisma.$transaction(async (tx) => {
      const active = await tx.supportTicket.updateMany({ where: { id, status: { not: SupportTicketStatus.RESOLVED } }, data: { updatedAt: new Date() } });
      if (!active.count) throw new ConflictException('Reabra o chamado antes de mudar de canal.');
      await tx.supportAuditLog.create({ data: { ticketId: id, actorId, action: 'WHATSAPP_HANDOFF' } });
    });
    return { url: `https://wa.me/${phone}` };
  }

  private messageContent(dto: CreateSupportMessageDto, origin: string) {
    const text = dto.text?.trim();
    const imageUrl = dto.imageUrl?.trim();
    const audioUrl = dto.audioUrl?.trim();
    if (dto.type === MessageType.TEXT && text && !imageUrl && !audioUrl && dto.durationMs === undefined) return { text };
    if (dto.type === MessageType.IMAGE && imageUrl && !text && !audioUrl && dto.durationMs === undefined && this.isUpload(imageUrl, origin, 'images')) return { imageUrl };
    if (dto.type === MessageType.AUDIO && audioUrl && !text && !imageUrl && this.isUpload(audioUrl, origin, 'audio')) return { audioUrl, durationMs: dto.durationMs ?? null };
    throw new BadRequestException('Conteudo da mensagem invalido.');
  }

  private isUpload(url: string, origin: string, directory: 'images' | 'audio') {
    try {
      const parsed = new URL(url);
      return parsed.origin === origin && new RegExp(`^/uploads/${directory}/[a-zA-Z0-9._-]+$`).test(parsed.pathname) && !parsed.search && !parsed.hash;
    } catch { return false; }
  }
}
