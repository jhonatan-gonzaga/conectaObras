CREATE TABLE `support_messages` (
  `id` VARCHAR(191) NOT NULL,
  `ticketId` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `type` ENUM('TEXT', 'AUDIO', 'IMAGE') NOT NULL DEFAULT 'TEXT',
  `text` TEXT NULL,
  `imageUrl` TEXT NULL,
  `audioUrl` TEXT NULL,
  `durationMs` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `support_messages_ticketId_createdAt_idx` (`ticketId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `support_audit_logs` (
  `id` VARCHAR(191) NOT NULL,
  `ticketId` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(191) NOT NULL,
  `fromStatus` ENUM('OPEN', 'IN_REVIEW', 'RESOLVED') NULL,
  `toStatus` ENUM('OPEN', 'IN_REVIEW', 'RESOLVED') NULL,
  `note` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `support_audit_logs_ticketId_createdAt_idx` (`ticketId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `support_messages`
  ADD CONSTRAINT `support_messages_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `support_messages_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `support_audit_logs`
  ADD CONSTRAINT `support_audit_logs_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `support_audit_logs_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `support_role_grants` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `userEmail` VARCHAR(191) NOT NULL,
  `previousRole` ENUM('CLIENTE', 'PROFISSIONAL', 'LOJISTA', 'SUPORTE') NOT NULL,
  `operator` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `support_role_grants_userId_createdAt_idx` (`userId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
