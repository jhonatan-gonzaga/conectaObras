# API de promoções da loja

As rotas administrativas exigem JWT de um usuário `LOJISTA`. A loja e o dono são identificados pelo token; nenhum identificador de loja é aceito no corpo.

| Método | Rota | Uso |
| --- | --- | --- |
| `POST` | `/api/store-promotions` | Criar promoção para um produto da própria loja. |
| `GET` | `/api/store-promotions` | Listar promoções da própria loja. Aceita `?status=CURRENT`, `SCHEDULED` ou `ENDED`. |
| `PATCH` | `/api/store-promotions/:id` | Alterar preço, percentual ou datas. Campos omitidos conservam o valor atual. |
| `PATCH` | `/api/store-promotions/:id/enabled` | Habilitar ou desabilitar com `{ "enabled": true/false }`. |

Criação exige `productId`, exatamente um de `promotionalPrice` e `discountPercent`, `startAt` e `endAt`. Datas devem ser timestamps ISO 8601 UTC terminados em `Z`, por exemplo `2099-01-01T12:00:00.000Z`. O término deve ser posterior ao início e estar no futuro. Preço promocional deve ser positivo e menor que o preço base; percentual deve estar entre 0 e 100, sem incluir os extremos. Para trocar de tipo de desconto no `PATCH`, informe o novo campo; o anterior será limpo.

O produto precisa pertencer à loja, estar `ACTIVE` e ter estoque positivo para receber ou reativar uma promoção. Promoções habilitadas do mesmo produto não podem ter períodos sobrepostos. A listagem calcula `status` pela hora atual em cada requisição: `SCHEDULED` antes do início, `CURRENT` durante o período e `ENDED` a partir do término. `enabled` é apresentado separadamente. Nenhum job é necessário para expirar a promoção.

`GET /api/products` e `GET /api/products/:id` são públicos e mostram produtos ativos de lojas e categorias ativas, inclusive com estoque zero. A listagem retorna `{ items, total, page, limit }` e aceita `storeId`, `categoryId`, `q`, `minPrice`, `maxPrice`, `inStock`, `onPromotion`, `page` e `limit` (padrão 20, máximo 100). Os filtros de preço usam `effectivePrice`. A resposta inclui `basePrice`, `effectivePrice`, estoque, capa, categoria, dados públicos da loja e `promotion` com identificador, desconto e datas somente quando vigente. O preço efetivo volta ao preço base quando a promoção é desabilitada, expira ou o estoque chega a zero. Início é inclusivo e término exclusivo; as datas representam instantes UTC.

As rotas legadas `/api/stores/me/promotions` continuam disponíveis para o aplicativo atual.
