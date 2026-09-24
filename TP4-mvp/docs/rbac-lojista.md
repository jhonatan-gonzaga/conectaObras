# RBAC do painel lojista

- **Task:** LOJA-002 — Implementar RBAC para LOJISTA
- **Dependencia:** LOJA-001 — Contrato v1 de loja, catalogo e operacao do lojista
- **Escopo atual:** autorizacao e propriedade aplicadas aos endpoints administrativos de loja

## Decisao sobre cadastro publico

O cadastro publico pode criar apenas contas `CLIENTE` e `PROFISSIONAL`. Contas
`LOJISTA` e `SUPORTE` dependem de promocao administrativa e auditavel, que nao
faz parte do endpoint publico `POST /api/auth/register`.

Enquanto a operacao administrativa de promocao nao existir, esses papeis devem
ser provisionados por um processo interno controlado. Nenhum endpoint publico
pode aceitar a promocao, nem mesmo como campo opcional.

Essa decisao preserva o cadastro profissional existente e impede que uma pessoa
obtenha acesso ao painel da loja ou ao suporte apenas alterando o corpo da
requisicao.

## Protecao das rotas

Toda rota administrativa de loja deve declarar os guards nesta ordem:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.LOJISTA)
```

O `JwtAuthGuard` autentica e preenche `request.user`; em seguida, o `RolesGuard`
autoriza somente os papeis declarados por `@Roles()`. Assim, token ausente ou
invalido retorna `401`, enquanto um usuario autenticado com papel incorreto
recebe `403`.

`SUPORTE` nao possui acesso implicito aos dados comerciais. Uma permissao futura
de suporte deve ser explicita e limitada ao caso de uso correspondente.

Os endpoints `GET /api/stores/me` e `PUT /api/stores/me` aplicam essa protecao
diretamente no `StoresController`. O primeiro consulta a loja autenticada; o
segundo cria ou atualiza somente essa mesma loja.

## Identidade e propriedade

Controllers passam apenas o usuario autenticado ao caso de uso:

```ts
findMine(@CurrentUser() user: AuthenticatedUser) {
  return this.storeService.findMine(user.id);
}
```

O caso de uso resolve a loja por `user.id`. Identificadores como `userId`,
`ownerId`, `customerId` ou uma loja administrativa nunca devem ser aceitos do
body, query ou cabecalho para definir propriedade.

Recursos administrativos tambem devem ser consultados dentro do escopo da loja
resolvida. Uma consulta Prisma futura deve combinar o identificador do recurso
com o proprietario autenticado, por exemplo:

```ts
prisma.product.findFirst({
  where: {
    id: productId,
    store: { ownerId: authenticatedUserId },
  },
});
```

Um recurso inexistente e um recurso de outra loja retornam o mesmo `404`. Essa
regra evita revelar a existencia de dados pertencentes a outra conta.

## Protecao contra mass assignment

- DTOs de entrada listam somente campos editaveis.
- `role`, `ownerId` e `storeId` nao pertencem a DTOs publicos de atualizacao.
- O `ValidationPipe` global usa `whitelist`, `forbidNonWhitelisted` e `transform`;
  campos desconhecidos recebem `400`.
- Services copiam campos permitidos explicitamente ao montar comandos Prisma;
  objetos recebidos do controller nao sao repassados por inteiro.

O fluxo de cadastro segue a mesma regra. `RegisterDto` aceita somente os papeis
publicos e `UsersService.createPublic` expoe e copia apenas os campos necessarios
para criar esse tipo de conta.

## Cobertura automatizada

Os testes unitarios validam os metadados do `RolesGuard`, papeis permitidos e
bloqueados e a politica do cadastro publico. A integracao HTTP valida a ordem
dos guards, a resolucao da loja pelo JWT, o bloqueio de leitura e alteracao
cruzadas e a rejeicao de `ownerId` e `storeId` no corpo.

A integracao usa o `StoresController` de producao. Os testes do `StoresService`
tambem verificam que `ownerId` vem do argumento autenticado, que consultas usam
esse filtro e que campos arbitrarios nao chegam aos comandos Prisma.
