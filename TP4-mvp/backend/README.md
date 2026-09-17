# Backend Conecta Obras

API REST com NestJS, Prisma e MySQL.

## Como rodar

1. Instale as dependencias:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

3. Confirme que o MySQL local esta ativo em `localhost:3306` e que o banco
   `COI` existe. No `.env`, informe a senha local do usuario `root` em
   `DATABASE_URL`.

4. Gere o Prisma Client, aplique as migrations no banco local e cadastre as
   categorias iniciais:

```bash
npm run db:setup
```

O comando equivale a:

```bash
npm run prisma:generate
npm run prisma:deploy
npm run seed:categories
```

5. Inicie a API:

```bash
npm run start:dev
```

A API escuta em `0.0.0.0:3000`, permitindo acesso pelo Expo Go na mesma rede.
No frontend, copie `.env.example` para `.env` e substitua `SEU_IP_LOCAL` pelo
IP do computador.

## Endpoints

Base URL local: `http://localhost:3000/api`

- `POST /auth/register`: cria usuario e retorna token.
- `POST /auth/login`: autentica usuario e retorna token.
- `GET /auth/me`: retorna o usuario autenticado. Envie `Authorization: Bearer <token>`.

## Exemplo de cadastro

```json
{
  "name": "Maria Silva",
  "email": "maria@email.com",
  "phone": "92999999999",
  "password": "123456",
  "role": "PROFISSIONAL"
}
```
