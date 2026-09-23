import { NotificationsModule } from '../notifications/notifications.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractStatusPolicyService } from './contract-status-policy.service';

@Module({
  imports: [PrismaModule, NotificationsModule, ConversationsModule],
  controllers: [ContractsController],
  providers: [ContractsService, ContractStatusPolicyService],
})
export class ContractsModule {}
