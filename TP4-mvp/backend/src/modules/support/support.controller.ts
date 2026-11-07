import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import { SupportQueueQueryDto } from './dto/support-queue-query.dto';
import { UpdateSupportStatusDto } from './dto/update-support-status.dto';
import { SupportService } from './support.service';

@UseGuards(JwtAuthGuard)
@Controller('support-tickets')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupportTicketDto,
  ) {
    return this.supportService.createTicket(user.id, dto);
  }

  @Get('my')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.supportService.findMine(user.id);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.supportService.detail(user, id);
  }

  @Post(':id/messages')
  sendMessage(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateSupportMessageDto, @Req() request: Request) {
    return this.supportService.sendMessage(user, id, dto, `${request.protocol}://${request.get('host')}`);
  }
}

@Controller('support-tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPORTE)
export class SupportAdminController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  queue(@Query() query: SupportQueueQueryDto) {
    return this.supportService.queue(query);
  }

  @Patch(':id/status')
  changeStatus(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateSupportStatusDto) {
    return this.supportService.changeStatus(user.id, id, dto);
  }

  @Post(':id/whatsapp')
  transferToWhatsApp(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.supportService.transferToWhatsApp(user.id, id);
  }
}
