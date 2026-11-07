const { PrismaClient, UserRole } = require('@prisma/client');

const [emailInput, operatorInput] = process.argv.slice(2);
const email = emailInput?.trim().toLowerCase();
const operator = operatorInput?.trim();

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !operator || operator.length > 191) {
  console.error('Uso: npm run support:provision -- usuario@exemplo.com operador-identificado');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { email }, select: { id: true, email: true, role: true } });
    if (!user) throw new Error('Conta não encontrada. Crie uma conta comum antes do provisionamento.');
    if (user.role === UserRole.SUPORTE) return { changed: false, id: user.id };
    await tx.user.update({ where: { id: user.id }, data: { role: UserRole.SUPORTE } });
    await tx.supportRoleGrant.create({ data: { userId: user.id, userEmail: user.email, previousRole: user.role, operator } });
    return { changed: true, id: user.id };
  });
  console.log(result.changed ? `Perfil SUPORTE concedido à conta ${result.id}.` : `A conta ${result.id} já possui perfil SUPORTE.`);
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : 'Falha no provisionamento.'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
