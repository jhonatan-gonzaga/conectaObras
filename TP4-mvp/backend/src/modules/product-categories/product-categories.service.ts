import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProductCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAllActive() {
    return this.prisma.productCategory.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
      },
      orderBy: [{ name: 'asc' }, { slug: 'asc' }],
    });
  }
}
