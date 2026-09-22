import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContractCreationService } from './contract-creation.service';

@Module({
  imports: [PrismaModule, NotificationsModule, ConversationsModule],
  providers: [ContractCreationService],
  exports: [ContractCreationService],
})
export class ContractCreationModule {}
