# LOJA-026 — Avaliações verificadas da loja

A reputação da loja é calculada exclusivamente a partir de `StoreReview`.
Não existe média persistida, nota editável no cadastro da loja ou atualização
manual da reputação pelo lojista. Esta entrega é de backend.

## Modelo e elegibilidade

`StoreReview` possui `orderId @unique`, `storeId`, `customerId`, nota inteira de
1 a 5, comentário opcional, `createdAt` e `updatedAt`. A migração
`20261025120000_verified_store_reviews` cria a tabela `store_reviews`, o índice
único por pedido, os índices de consulta e um `CHECK` SQL para os limites da nota.
As chaves estrangeiras usam `RESTRICT`: excluir uma loja, pedido ou cliente
referenciado não apaga avaliações em cascata e fica bloqueado enquanto houver
o vínculo.

Na estrutura atual, `DELIVERED` pertence a `DeliveryStatus`; o pedido é finalizado
como `StoreOrderStatus.COMPLETED`. A criação exige os dois estados, além de
`StoreOrder.customerId` corresponder ao usuário autenticado. Um pedido legado
sem cliente, sem entrega ou somente marcado como `COMPLETED` não é elegível.

O autor vem do JWT e a loja vem do pedido. O cliente não pode escolher esses
campos no payload. O índice único também impede duplicidade entre requisições
concorrentes; a API transforma a violação de unicidade em HTTP 409.

## Rotas

As rotas abaixo usam o prefixo global `/api`.

| Método | Caminho | Acesso |
| --- | --- | --- |
| POST | `/orders/:orderId/review` | JWT com papel `CLIENTE`, somente para pedido próprio entregue |
| GET | `/stores/:storeId/reviews` | Público, somente loja `ACTIVE` |
| GET | `/stores/me/reviews` | JWT com papel `LOJISTA`, somente sua própria loja, em qualquer estado |

Não há rotas de edição ou exclusão, inclusive para o dono da loja. O cadastro
da loja também rejeita campos `rating` e `reputation` pelo whitelist da API.
A rota estática `/stores/me/reviews` é registrada antes da rota pública com
`:storeId` para que não possa ser acessada como uma consulta pública.

### Criar avaliação

```http
POST /api/orders/PEDIDO_ID/review
Authorization: Bearer TOKEN_DO_CLIENTE
Content-Type: application/json

{
  "rating": 5,
  "comment": "Produto e entrega atenderam às expectativas."
}
```

`rating` deve ser um número inteiro; strings como `"5"` não são aceitas.
O comentário é opcional, limitado a 2.000 caracteres. Espaços nas extremidades
são removidos; comentário vazio é armazenado como `null`.

| HTTP | Situação |
| --- | --- |
| 201 | Avaliação criada |
| 400 | Nota/comentário inválido, campo extra ou pedido sem os estados exigidos |
| 401 | Sem autenticação válida |
| 403 | Papel sem permissão para criar |
| 404 | Pedido inexistente ou pertencente a outro cliente |
| 409 | Pedido já avaliado, inclusive em submissão concorrente |

### Leitura e reputação

```http
GET /api/stores/LOJA_ID/reviews?page=1&limit=20
```

```json
{
  "items": [
    {
      "id": "AVALIACAO_ID",
      "storeId": "LOJA_ID",
      "rating": 5,
      "comment": "Produto e entrega atenderam às expectativas.",
      "createdAt": "2026-10-25T12:00:00.000Z",
      "updatedAt": "2026-10-25T12:00:00.000Z",
      "customer": { "name": "Cliente" }
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "reputation": {
    "averageRating": 5,
    "reviewCount": 1,
    "distribution": { "1": 0, "2": 0, "3": 0, "4": 0, "5": 1 }
  }
}
```

Paginação: `page` padrão 1, `limit` padrão 20, máximo 100 itens. Página e limite
aceitam apenas inteiros decimais positivos. O máximo de página é 21.474.836
para manter o deslocamento dentro do intervalo de `skip` do Prisma. Parâmetros
desconhecidos, repetidos ou estruturados são rejeitados. A ordenação é por
`createdAt DESC, id DESC`; uma página além do fim retorna `items: []`.

`aggregate` calcula média e quantidade sobre **todas** as avaliações da loja;
`groupBy(rating)` calcula a distribuição. A página não limita a reputação.
Sem avaliações, `averageRating` é `null`, quantidade é zero e todos os cinco
grupos são zero. A média não é arredondada nem gravada no banco. Cada leitura
consulta novamente as avaliações, em uma transação `RepeatableRead`, mantendo
página, quantidade, média e distribuição no mesmo snapshot.

As respostas não expõem `orderId`, `customerId`, e-mail, telefone ou endereço.
O mesmo formato é usado para leitura pública e do dono. Lojas inativas não
aparecem pela rota pública, mas o dono pode consultar seu histórico.

## Migração e testes

No pacote `backend`, com `.env` configurado:

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run typecheck
npm test
```

Os testes de serviço e HTTP cobrem autoria, estados do pedido/entrega,
duplicidade, limites da nota, agregação, distribuição, paginação, permissões,
campos indevidos, privacidade da resposta e ausência de edição/exclusão.

O teste MySQL exige um banco **novo, vazio e descartável**, com nome iniciado
por `store_reviews_test_`, em MySQL >= 8.0.16. Ele aplica as migrações e cria
fixtures, incluindo avaliações concorrentes, verificando índice único,
`CHECK`, vínculos e agregação reais. Nunca configure esse teste com `COI`.

```bash
export STORE_REVIEWS_TEST_DATABASE_URL='mysql://USUARIO:SENHA@localhost:3306/store_reviews_test_loja026'
npm run test:compile
node --test dist-test/test/store-reviews.integration.spec.js
```

Sem essa variável, apenas o teste de integração MySQL é ignorado; os testes
de serviço e HTTP continuam executando normalmente. Use um banco vazio a
cada execução. Nenhuma migração anterior foi alterada.
