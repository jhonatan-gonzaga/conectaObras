const { PrismaClient } = require('@prisma/client');

const productCategories = [
  { name: 'Cimento e argamassa', slug: 'cimento-e-argamassa' },
  { name: 'Areia e brita', slug: 'areia-e-brita' },
  { name: 'Tijolos e blocos', slug: 'tijolos-e-blocos' },
  { name: 'Ferragens', slug: 'ferragens' },
  { name: 'Elétrica', slug: 'eletrica' },
  { name: 'Hidráulica', slug: 'hidraulica' },
  { name: 'Tintas', slug: 'tintas' },
  { name: 'Ferramentas', slug: 'ferramentas' },
  { name: 'Acabamento', slug: 'acabamento' },
];

async function seedProductCategories(prisma) {
  for (const category of productCategories) {
    await prisma.productCategory.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();

  seedProductCategories(prisma)
    .then(() => console.log(`Categorias de produto cadastradas: ${productCategories.length}`))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { productCategories, seedProductCategories };
