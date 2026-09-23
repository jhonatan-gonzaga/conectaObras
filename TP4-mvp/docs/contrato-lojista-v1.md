# Contrato v1 — Loja, catálogo e operação do lojista

- **Task:** LOJA-001 — Congelar contratos e matriz de permissões
- **Estado:** aprovado para implementação incremental
- **Data:** 2026-09-22
- **Prefixo HTTP:** `/api`

## 1. Objetivo e alcance

Este documento é a fonte de verdade dos contratos HTTP planejados para loja, catálogo, promoções, pedidos comerciais, entregas, avaliações e conversas de loja.

As rotas descritas aqui ainda serão implementadas pelas tasks posteriores. Os endpoints atuais do MVP permanecem compatíveis enquanto a nova área é entregue.

O contrato protege as seguintes fronteiras:

- HTTP/NestJS converte request, query e multipart em objetos simples;
- casos de uso não recebem `Request`, `Response`, tipos Prisma ou entidades ORM;
- regras de transição, disponibilidade e preço ficam em policies puras;
- repositories, Prisma, upload, relógio e notificação são adapters externos;
- controllers aplicam autenticação/validação e delegam uma ação por chamada;
- papel é validado por guard; propriedade e participação são validadas pelo caso de uso.

## 2. Convenções globais

### 2.1 Identidade e segurança

- Rotas privadas usam `Authorization: Bearer <JWT>`.
- `userId`, `ownerId`, `customerId` e a loja administrativa nunca são aceitos do body.
- A loja do lojista é resolvida pelo `user.id` autenticado.
- IDs são strings opacas. O cliente não deve interpretar o formato do CUID.
- Recurso pertencente a outro usuário retorna `404 RESOURCE_NOT_FOUND`, evitando confirmar sua existência.
- `SUPORTE` não ganha acesso implícito aos dados comerciais. Acesso administrativo futuro exigirá endpoint e permissão explícitos.

### 2.2 Validação

O `ValidationPipe` global mantém:

```ts
{
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}
```

Campos desconhecidos retornam `400`. DTOs HTTP usam `class-validator`, mas objetos de entrada dos casos de uso são tipos TypeScript simples.

### 2.3 Dinheiro, números e datas

- Entradas e saídas monetárias usam string decimal: `"149.90"`.
- Formato monetário: `^(0|[1-9]\d{0,7})(\.\d{1,2})?$`, salvo limite mais restritivo no DTO.
- O backend converte dinheiro para `Decimal`; nunca usa `number`, `parseFloat` ou tolerância de ponto flutuante em regras.
- Estoque e quantidade são inteiros maiores ou iguais a zero; quantidade de pedido é maior que zero.
- Instantes usam ISO 8601 em UTC, por exemplo `2026-09-22T14:30:00.000Z`.
- Horário comercial usa `HH:mm`, interpretado no fuso da loja. No MVP, o fuso padrão é `America/Manaus`.

### 2.4 Paginação

Todas as listas, exceto mensagens, aceitam:

| Campo | Padrão | Regra |
|---|---:|---|
| `page` | `1` | inteiro `>= 1` |
| `limit` | `20` | inteiro entre `1` e `100` |

Resposta:

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 20
}
```

Ordenação padrão: `createdAt DESC, id DESC`, salvo quando este documento indicar outra ordem.

Mensagens usam cursor opaco:

```json
{
  "items": [],
  "nextCursor": null
}
```

O cursor representa `createdAt + id`; `limit` tem padrão `30` e máximo `100`.

### 2.5 Erros

Formato das novas rotas:

```json
{
  "statusCode": 409,
  "code": "INVALID_STATUS_TRANSITION",
  "message": "A transicao solicitada nao e permitida.",
  "details": {
    "from": "ARCHIVED",
    "to": "ACTIVE"
  }
}
```

`details` é opcional e nunca contém senha, token, stack trace ou dados de outro usuário.

| HTTP | Código | Uso |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | DTO, query, dinheiro, data ou arquivo inválido |
| `401` | `AUTHENTICATION_REQUIRED` | token ausente, inválido ou expirado |
| `403` | `FORBIDDEN_ROLE` | papel sem permissão para a rota |
| `404` | `RESOURCE_NOT_FOUND` | inexistente ou pertencente a outra conta |
| `409` | `INVALID_STATUS_TRANSITION` | transição de estado proibida |
| `409` | `STORE_INCOMPLETE` | tentativa de ativar loja incompleta |
| `409` | `STORE_REQUIRED` | lojista ainda não possui loja |
| `409` | `PRODUCT_INCOMPLETE` | tentativa de ativar produto sem requisitos obrigatórios |
| `409` | `CNPJ_ALREADY_IN_USE` | CNPJ normalizado duplicado |
| `409` | `SKU_ALREADY_IN_USE` | SKU duplicado na mesma loja |
| `409` | `INSUFFICIENT_STOCK` | quantidade indisponível |
| `409` | `PROMOTION_OVERLAP` | produto já possui promoção no período |
| `409` | `REVIEW_ALREADY_EXISTS` | pedido já avaliado |
| `413` | `UPLOAD_TOO_LARGE` | imagem acima do limite |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | formato de imagem não aceito |
| `500` | `INTERNAL_ERROR` | falha inesperada, sem detalhes internos |

Erros de domínio são independentes do NestJS. Um presenter/filter HTTP faz a tradução para a tabela acima.

## 3. Tipos e respostas compartilhadas

### 3.1 Enums públicos

```ts
type StoreStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
type ProductStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELED';
type DeliveryStatus =
  | 'PENDING'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'DELAYED'
  | 'DELIVERED'
  | 'CANCELED';
type ConversationContext = 'SERVICE' | 'STORE' | 'SUPPORT';
type MessageType = 'TEXT' | 'AUDIO' | 'IMAGE';
```

### 3.2 Loja

```ts
type AddressResponse = {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string | null;
  zipCode: string | null;
  complement: string | null;
};

type OpeningHourResponse = {
  dayOfWeek: 'SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';
  openingTime: string | null;
  closingTime: string | null;
  closed: boolean;
};

type StoreSummaryResponse = {
  id: string;
  name: string;
  logoUrl: string | null;
  phone: string;
  status: StoreStatus;
  address: Pick<AddressResponse, 'neighborhood' | 'city' | 'state'>;
  ratingAverage: string | null;
  reviewCount: number;
  openNow: boolean;
};

type StoreDetailResponse = StoreSummaryResponse & {
  cnpj?: string; // somente em /stores/me; mascarado ou ausente no contrato publico
  description: string | null;
  whatsapp: string | null;
  address: AddressResponse;
  openingHours: OpeningHourResponse[];
  createdAt: string;
  updatedAt: string;
};
```

### 3.3 Produto e promoção

```ts
type ProductImageResponse = {
  id: string;
  url: string;
  altText: string | null;
  position: number;
  isCover: boolean;
};

type ProductSummaryResponse = {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  sku: string | null;
  status: ProductStatus;
  stock: number;
  available: boolean; // derivado; nao persistido como fonte da verdade
  basePrice: string;
  effectivePrice: string;
  discountPercent: string | null;
  coverImage: ProductImageResponse | null;
  updatedAt: string;
};

type ProductDetailResponse = ProductSummaryResponse & {
  description: string | null;
  category: { id: string; name: string; slug: string };
  store: StoreSummaryResponse;
  images: ProductImageResponse[];
  promotion: PromotionResponse | null;
  lastPriceUpdateAt: string | null;
  createdAt: string;
};

type PromotionResponse = {
  id: string;
  productId: string;
  promotionalPrice: string | null;
  discountPercent: string | null;
  startAt: string;
  endAt: string;
  enabled: boolean;
  state: 'SCHEDULED' | 'ACTIVE' | 'PAUSED' | 'EXPIRED'; // derivado
  effectivePrice: string;
  createdAt: string;
  updatedAt: string;
};
```

### 3.4 Pedido, entrega e avaliação

```ts
type OrderItemResponse = {
  id: string;
  productId: string | null;
  productName: string;
  sku: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
};

type OrderResponse = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotal: string;
  discount: string;
  total: string;
  note: string | null;
  deliveryAddress: AddressResponse;
  store: Pick<StoreSummaryResponse, 'id' | 'name' | 'logoUrl'>;
  customer: { id: string; name: string; phone: string | null };
  items: OrderItemResponse[];
  delivery: DeliveryResponse | null;
  statusHistory: Array<{
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    note: string | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

type DeliveryResponse = {
  status: DeliveryStatus;
  trackingCode: string | null;
  carrier: string | null;
  estimatedAt: string | null;
  deliveredAt: string | null;
  delayed: boolean;
  updatedAt: string;
};

type StoreReviewResponse = {
  id: string;
  orderId: string;
  rating: number;
  comment: string | null;
  customer: { id: string; name: string };
  createdAt: string;
};
```

Campos internos, hashes, IDs de adapters, custo, metadados de auditoria e entidades Prisma nunca fazem parte dessas respostas.

## 4. DTOs de entrada

### 4.1 Loja

`UpsertMyStoreDto`:

```json
{
  "name": "Constrular Itacoatiara",
  "cnpj": "12.345.678/0001-90",
  "description": "Materiais para construcao e reforma.",
  "phone": "+5592999999999",
  "whatsapp": "+5592999999999",
  "address": {
    "street": "Rua das Obras",
    "number": "100",
    "neighborhood": "Centro",
    "city": "Itacoatiara",
    "state": "AM",
    "zipCode": "69100-000",
    "complement": null
  },
  "openingHours": [
    {
      "dayOfWeek": "MONDAY",
      "openingTime": "08:00",
      "closingTime": "18:00",
      "closed": false
    }
  ]
}
```

Regras: nome `2..120`, descrição até `1000`, telefone/WhatsApp em E.164 após normalização, CNPJ com checksum válido, sete dias no máximo e sem dias duplicados.

`UpdateStoreStatusDto`: `{ "status": "ACTIVE" | "INACTIVE" }`.

Logo usa `multipart/form-data`, campo `file`, somente JPEG/PNG, máximo 5 MB. O adapter retorna URL pública; o caso de uso recebe um arquivo abstrato e não conhece Multer.

### 4.2 Produto

`CreateProductDto`/`UpdateProductDto`:

```json
{
  "categoryId": "category-id",
  "name": "Cimento CP II 50 kg",
  "sku": "CIM-CP2-50",
  "description": "Cimento para uso geral.",
  "price": "42.90",
  "stock": 30
}
```

Regras: nome `2..120`, SKU normalizado e até `64`, descrição até `1000`, preço `> 0`, estoque inteiro `>= 0` e categoria ativa.

- `UpdateProductStatusDto`: `{ "status": "ACTIVE" | "INACTIVE" }`.
- `UpdateInventoryDto`: pelo menos um entre `{ "price": "44.90", "stock": 25 }`.
- `AddProductImageDto`: multipart `file` e campo opcional `altText`; JPEG/PNG, 5 MB.
- `ReorderProductImagesDto`: `{ "imageIds": ["id-1", "id-2"] }`, contendo exatamente todas as imagens do produto uma vez.
- `SetCoverImageDto`: `{ "imageId": "id-1" }`.

### 4.3 Promoção

`CreatePromotionDto`/`UpdatePromotionDto`:

```json
{
  "productId": "product-id",
  "promotionalPrice": "37.90",
  "discountPercent": null,
  "startAt": "2026-09-25T04:00:00.000Z",
  "endAt": "2026-10-01T03:59:59.999Z",
  "enabled": true
}
```

Exatamente um entre `promotionalPrice` e `discountPercent`; preço promocional menor que o preço base; percentual `> 0` e `< 100`; `startAt < endAt`; períodos do mesmo produto não se sobrepõem.

`UpdatePromotionEnabledDto`: `{ "enabled": true }`.

### 4.4 Pedido e entrega

`CreateOrderDto`:

```json
{
  "items": [
    { "productId": "product-id", "quantity": 2 }
  ],
  "deliveryAddress": {
    "street": "Rua A",
    "number": "10",
    "neighborhood": "Centro",
    "city": "Itacoatiara",
    "state": "AM",
    "zipCode": "69100-000",
    "complement": null
  },
  "note": "Entregar pela manha."
}
```

O cliente não envia preço, desconto, total, loja nem status. Todos os produtos devem ser da mesma loja. O backend recalcula preço efetivo e estoque dentro da transação.

- `UpdateOrderStatusDto`: `{ "status": "CONFIRMED", "note": null }`.
- `CancelOrderDto`: `{ "reason": "Desisti da compra." }`, motivo entre `3..500`.
- `UpsertDeliveryDto`: `{ "carrier": "Entrega da loja", "trackingCode": "ABC123", "estimatedAt": "2026-09-30T18:00:00.000Z" }`.
- `UpdateDeliveryStatusDto`: `{ "status": "IN_TRANSIT", "note": null }`.
- `CreateStoreReviewDto`: `{ "rating": 5, "comment": "Entrega no prazo." }`, nota inteira `1..5`, comentário opcional até `1000`.

### 4.5 Conversa de loja

- `CreateStoreConversationDto`: `{ "storeId": "id", "productId": "id opcional", "orderId": "id opcional" }`; produto/pedido devem pertencer à loja e o pedido deve pertencer ao cliente.
- `CreateStoreMessageDto`: texto JSON `{ "type": "TEXT", "text": "Mensagem" }`; imagem/áudio reutilizam o contrato de upload e enviam uma referência de mídia pertencente ao remetente.
- `MarkConversationReadDto`: `{ "readThrough": "2026-09-22T14:30:00.000Z" }`.

## 5. Catálogo de endpoints e matriz rota × papel

Legenda: `✓` permitido; `—` negado; `P` participante; `O` proprietário da loja/recurso. Usuários autenticados também podem consumir rotas públicas.

### 5.1 Loja e dashboard

| Método e rota | Entrada | Saída | Público | CLIENTE | PROFISSIONAL | LOJISTA | SUPORTE |
|---|---|---|:---:|:---:|:---:|:---:|:---:|
| `GET /stores` | `q,city,neighborhood,openNow,page,limit` | `Paginated<StoreSummary>` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /stores/:id` | path ID | `StoreDetail` público | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /stores/:id/reviews` | `page,limit` | `Paginated<StoreReview>` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /stores/me` | — | `StoreDetail` privado | — | — | — | O | — |
| `PUT /stores/me` | `UpsertMyStoreDto` | `StoreDetail` privado | — | — | — | O | — |
| `PATCH /stores/me/status` | `UpdateStoreStatusDto` | `StoreDetail` privado | — | — | — | O | — |
| `PUT /stores/me/logo` | multipart | `StoreDetail` privado | — | — | — | O | — |
| `GET /stores/me/dashboard` | — | `StoreDashboardResponse` | — | — | — | O | — |

`StoreDashboardResponse` contém contadores agregados: produtos ativos, produtos com estoque baixo (`<= 5`), promoções vigentes, pedidos por status e conversas não lidas. Todos os contadores usam a loja resolvida pelo JWT.

### 5.2 Categorias, produtos e imagens

| Método e rota | Entrada | Saída | Público | CLIENTE | PROFISSIONAL | LOJISTA | SUPORTE |
|---|---|---|:---:|:---:|:---:|:---:|:---:|
| `GET /product-categories` | — | categorias ativas | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /products` | `storeId,categoryId,q,minPrice,maxPrice,inStock,onPromotion,page,limit` | `Paginated<ProductSummary>` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `GET /products/:id` | path ID | `ProductDetail` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `POST /store-products` | `CreateProductDto` | `ProductDetail`, `201` | — | — | — | O | — |
| `GET /store-products` | `q,categoryId,status,stock,page,limit` | `Paginated<ProductSummary>` privado | — | — | — | O | — |
| `GET /store-products/:id` | path ID | `ProductDetail` privado | — | — | — | O | — |
| `PATCH /store-products/:id` | `UpdateProductDto` | `ProductDetail` | — | — | — | O | — |
| `PATCH /store-products/:id/status` | `UpdateProductStatusDto` | `ProductDetail` | — | — | — | O | — |
| `PATCH /store-products/:id/inventory` | `UpdateInventoryDto` | `ProductDetail` | — | — | — | O | — |
| `DELETE /store-products/:id` | — | `204` (arquivamento) | — | — | — | O | — |
| `POST /store-products/:id/images` | multipart | `ProductImage`, `201` | — | — | — | O | — |
| `PATCH /store-products/:id/images/order` | `ReorderProductImagesDto` | `ProductImage[]` | — | — | — | O | — |
| `PATCH /store-products/:id/images/cover` | `SetCoverImageDto` | `ProductImage[]` | — | — | — | O | — |
| `DELETE /store-products/:id/images/:imageId` | — | `204` | — | — | — | O | — |

Rotas públicas omitem loja/produto inativo, arquivado ou sem estoque. Rotas administrativas mostram esses estados ao proprietário.

### 5.3 Promoções

| Método e rota | Entrada | Saída | Público | CLIENTE | PROFISSIONAL | LOJISTA | SUPORTE |
|---|---|---|:---:|:---:|:---:|:---:|:---:|
| `POST /store-promotions` | `CreatePromotionDto` | `Promotion`, `201` | — | — | — | O | — |
| `GET /store-promotions` | `state,page,limit` | `Paginated<Promotion>` | — | — | — | O | — |
| `PATCH /store-promotions/:id` | `UpdatePromotionDto` | `Promotion` | — | — | — | O | — |
| `PATCH /store-promotions/:id/enabled` | `UpdatePromotionEnabledDto` | `Promotion` | — | — | — | O | — |

Promoções públicas aparecem incorporadas em produto/loja somente durante a vigência. Não existe rota pública que exponha promoção pausada ou futura.

### 5.4 Pedidos, entrega e avaliação

| Método e rota | Entrada | Saída | Público | CLIENTE | PROFISSIONAL | LOJISTA | SUPORTE |
|---|---|---|:---:|:---:|:---:|:---:|:---:|
| `POST /orders` | `CreateOrderDto` | `Order`, `201` | — | ✓ | — | — | — |
| `GET /orders/my` | `status,page,limit` | `Paginated<Order>` | — | ✓ | — | — | — |
| `GET /orders/my/:id` | path ID | `Order` | — | ✓ | — | — | — |
| `POST /orders/:id/cancel` | `CancelOrderDto` | `Order` | — | ✓ | — | — | — |
| `POST /orders/:id/store-review` | `CreateStoreReviewDto` | `StoreReview`, `201` | — | ✓ | — | — | — |
| `GET /store-orders` | `status,from,to,page,limit` | `Paginated<Order>` | — | — | — | O | — |
| `GET /store-orders/:id` | path ID | `Order` | — | — | — | O | — |
| `PATCH /store-orders/:id/status` | `UpdateOrderStatusDto` | `Order` | — | — | — | O | — |
| `POST /store-orders/:id/cancel` | `CancelOrderDto` | `Order` | — | — | — | O | — |
| `PUT /store-orders/:id/delivery` | `UpsertDeliveryDto` | `Delivery` | — | — | — | O | — |
| `PATCH /store-orders/:id/delivery/status` | `UpdateDeliveryStatusDto` | `Order` com entrega | — | — | — | O | — |

O telefone do cliente só aparece ao lojista vinculado ao pedido. Endereço de entrega nunca aparece em endpoints públicos.

### 5.5 Conversas de loja

| Método e rota | Entrada | Saída | Público | CLIENTE | PROFISSIONAL | LOJISTA | SUPORTE |
|---|---|---|:---:|:---:|:---:|:---:|:---:|
| `POST /store-conversations` | `CreateStoreConversationDto` | `Conversation`, `200/201` | — | ✓ | — | — | — |
| `GET /store-conversations` | `unread,page,limit` | conversas do autenticado | — | P | — | P | — |
| `GET /store-conversations/:id/messages` | `cursor,limit` | página por cursor | — | P | — | P | — |
| `POST /store-conversations/:id/messages` | `CreateStoreMessageDto` | `Message`, `201` | — | P | — | P | — |
| `PATCH /store-conversations/:id/read` | `MarkConversationReadDto` | `{ "unreadCount": 0 }` | — | P | — | P | — |

Participação é verificada em todo acesso. O papel sozinho não concede leitura da conversa.

## 6. Policies de estado

Solicitar o estado atual é idempotente: retorna `200`, não cria novo histórico e não repete notificação. Qualquer transição ausente nas tabelas retorna `409 INVALID_STATUS_TRANSITION`.

### 6.1 Loja

| Origem | Destino | Ator | Pré-condições | Falha específica |
|---|---|---|---|---|
| `DRAFT` | `ACTIVE` | `LOJISTA` proprietário | perfil, CNPJ, telefone, endereço e ao menos um dia aberto | `STORE_INCOMPLETE` |
| `ACTIVE` | `INACTIVE` | `LOJISTA` proprietário | nenhuma | — |
| `INACTIVE` | `ACTIVE` | `LOJISTA` proprietário | mesmos requisitos de ativação | `STORE_INCOMPLETE` |

`DRAFT` não aparece publicamente. Inativação não apaga catálogo, pedidos ou conversas.

### 6.2 Produto

| Origem | Destino | Ator | Pré-condições | Falha específica |
|---|---|---|---|---|
| `DRAFT` | `ACTIVE` | `LOJISTA` proprietário | loja ativa, categoria ativa, campos completos e imagem de capa | `PRODUCT_INCOMPLETE` |
| `DRAFT` | `ARCHIVED` | `LOJISTA` proprietário | nenhuma | — |
| `ACTIVE` | `INACTIVE` | `LOJISTA` proprietário | nenhuma | — |
| `ACTIVE` | `ARCHIVED` | `LOJISTA` proprietário | nenhuma | — |
| `INACTIVE` | `ACTIVE` | `LOJISTA` proprietário | mesmos requisitos de ativação | `PRODUCT_INCOMPLETE` |
| `INACTIVE` | `ARCHIVED` | `LOJISTA` proprietário | nenhuma | — |

`ARCHIVED` é terminal. Estoque zero torna `available=false`, mas não muda o status administrativo.

### 6.3 Pedido

| Origem | Destino | Ator | Pré-condições | Efeito |
|---|---|---|---|---|
| — | `PENDING` | `CLIENTE` | pedido criado e estoque reservado/decrementado | cria histórico inicial |
| `PENDING` | `CONFIRMED` | `LOJISTA` proprietário | pedido válido | notifica cliente |
| `PENDING` | `CANCELED` | cliente do pedido ou lojista proprietário | motivo obrigatório | repõe estoque uma vez |
| `CONFIRMED` | `PREPARING` | `LOJISTA` proprietário | nenhuma | notifica cliente |
| `CONFIRMED` | `CANCELED` | cliente do pedido ou lojista proprietário | ainda não iniciou preparação | repõe estoque uma vez |
| `PREPARING` | `READY` | `LOJISTA` proprietário | separação concluída | notifica cliente |
| `PREPARING` | `CANCELED` | `LOJISTA` proprietário | motivo obrigatório | repõe estoque uma vez |
| `READY` | `OUT_FOR_DELIVERY` | `LOJISTA` proprietário ou sistema pela entrega | entrega cadastrada | notifica cliente |
| `READY` | `CANCELED` | `LOJISTA` proprietário | motivo obrigatório | repõe estoque uma vez |
| `OUT_FOR_DELIVERY` | `DELIVERED` | `LOJISTA` proprietário ou sistema pela entrega | entrega confirmada | define conclusão |

`DELIVERED` e `CANCELED` são terminais. Cliente não cancela a partir de `PREPARING`.

### 6.4 Entrega

| Origem | Destino | Ator | Pré-condições | Sincronização |
|---|---|---|---|---|
| — | `PENDING` | `LOJISTA` proprietário | pedido `CONFIRMED`, `PREPARING` ou `READY` | cria entrega |
| `PENDING` | `DISPATCHED` | `LOJISTA` proprietário | pedido `READY` | pedido vai para `OUT_FOR_DELIVERY` |
| `DISPATCHED` | `IN_TRANSIT` | `LOJISTA` proprietário | nenhuma | mantém pedido em entrega |
| `DISPATCHED` | `DELAYED` | lojista ou sistema | previsão vencida ou ocorrência | notifica cliente |
| `IN_TRANSIT` | `DELAYED` | lojista ou sistema | previsão vencida ou ocorrência | notifica cliente |
| `DELAYED` | `IN_TRANSIT` | `LOJISTA` proprietário | entrega retomada | notifica cliente |
| `IN_TRANSIT` | `DELIVERED` | `LOJISTA` proprietário | confirmação de entrega | pedido vai para `DELIVERED` |
| `DELAYED` | `DELIVERED` | `LOJISTA` proprietário | confirmação de entrega | pedido vai para `DELIVERED` |
| estado não terminal | `CANCELED` | sistema após cancelamento do pedido | pedido cancelado | não executa isoladamente |

`delayed` também é derivado como verdadeiro quando `estimatedAt < now` e a entrega não está `DELIVERED`/`CANCELED`, mesmo antes da persistência de `DELAYED`.

## 7. Decisões de compatibilidade

- `Category` atual continua classificando serviços; produto usa `ProductCategory`.
- `Review` atual continua avaliando profissionais; loja usa `StoreReview`.
- rotas atuais de `contracts` não são reutilizadas para pedidos de produto;
- `Conversation` será generalizada por migration/backfill; rotas atuais continuam durante a transição;
- respostas existentes de upload permanecem compatíveis, mas novos casos de uso de loja não dependem de caminho local nem de `Express.Multer.File`;
- respostas Prisma são mapeadas para os tipos deste documento antes de sair do adapter.
- nos controllers NestJS, rotas estáticas como `/stores/me` são declaradas antes de rotas parametrizadas como `/stores/:id`.

## 8. Linha de base antes da implementação

Executada em 2026-09-22 sobre o commit `e9ddf10`:

| Projeto | Comando | Resultado |
|---|---|---|
| Backend | `npm run typecheck` | passou |
| Backend | `npm run build` | passou |
| Backend | `npm test` | 78 testes passaram |
| Frontend | `npm run typecheck` | passou |
| Frontend | `npm test -- --runInBand` | 3 suítes e 32 testes passaram |

## 9. Checklist de alteração do contrato

Qualquer alteração posterior deve:

1. atualizar este arquivo antes ou junto do código;
2. indicar compatibilidade ou quebra;
3. atualizar DTOs/tipos do backend e frontend na mesma entrega;
4. atualizar matriz de permissões e policies quando aplicável;
5. adicionar teste de contrato ou integração;
6. preservar dinheiro como string decimal e datas em UTC;
7. não expor tipos de framework, ORM ou infraestrutura ao domínio.
