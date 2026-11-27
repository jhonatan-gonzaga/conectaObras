import type { Prisma } from '@prisma/client';

// Formato compartilhado dos endpoints que retornam contratos completos.
// Datas e valores decimais mantem a serializacao padrao do Prisma.
export const contractInclude = {
  client: { include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } } },
  professional: {
    include: {
      user: { select: { id: true, name: true, phone: true, avatarUrl: true } },
      specialties: { include: { category: true } },
    },
  },
  ad: { include: { category: true, images: true } },
  application: true,
  directRequest: { include: { images: true } },
  statusHistory: { orderBy: { createdAt: 'desc' } },
  conversations: {
    include: {
      messages: {
        include: { sender: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  },
  review: true,
} satisfies Prisma.ContractInclude;

export type ContractWithRelations = Prisma.ContractGetPayload<{
  include: typeof contractInclude;
}>;
