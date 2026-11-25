# Persistência do catálogo

A migration `20260926090000_add_product_catalog` cria três tabelas independentes
das categorias de serviços. Requer MySQL >= 8.0.16 para aplicar os `CHECK`.
Nenhuma migration anterior é alterada, nem há cópia de categorias profissionais.

## Modelo e integridade

- `ProductCategory`: nome, slug único, descrição e imagem opcionais, `active`
  inicialmente verdadeiro e timestamps.
- `Product`: loja e categoria obrigatórias, SKU opcional de até 64 caracteres,
  nome de até 120 caracteres, descrição opcional, `price DECIMAL(10,2)` obrigatório
  e positivo, `stock INT NOT NULL DEFAULT 0` não negativo. Os estados seguem o
  contrato v1: `DRAFT`, `ACTIVE`, `INACTIVE` e `ARCHIVED`.
- `lastPriceUpdateAt` registra inicialmente a criação. O adapter atualiza preço e
  data na mesma instrução; preço igual não altera a data. Usa `Decimal` na
  persistência e string com duas casas na saída, sem conversão para `number`.
- `ProductImage`: produto e URL obrigatórios; chave de objeto e texto alternativo
  opcionais; posição não negativa, indicador de capa e timestamps.
- `UNIQUE(storeId, sku)` permite vários SKUs nulos e o mesmo SKU em lojas distintas.
  O adapter remove espaços nas extremidades, converte SKU para maiúsculas e
  transforma SKU vazio em `null`. A collation `utf8mb4_unicode_ci` também rejeita
  duplicatas que diferem apenas em caixa/acentos na mesma loja. O SKU de um produto
  arquivado continua reservado.
- Índices: `(storeId, status)`, `(categoryId, status)`, `name` e, nas imagens,
  `(productId, position)`. Leituras ordenam imagens por `position ASC, id ASC`,
  inclusive quando posições se repetem. `isCover` não muda essa ordem.

## Exclusão, arquivamento e pedidos

| Relação | `onDelete` | Efeito |
|---|---|---|
| Produto → loja | `Restrict` | Impede apagar loja com produtos, inclusive arquivados; também bloqueia a cascata da exclusão do proprietário. |
| Produto → categoria de produto | `Restrict` | Impede apagar categoria em uso; ela pode ser desativada. |
| Imagem → produto | `Cascade` | Exclusão física excepcional de produto não deixa imagens órfãs. |

O `ProductRepository` oferece `archive`, sem método de exclusão física. Arquivar
altera somente o estado administrativo e o timestamp de atualização, preservando
ID, preço, estoque e imagens para referências históricas. O adapter não altera
preço de produtos arquivados.

Ainda não existem `Order`/`OrderItem` no schema deste repositório. A futura FK de
`OrderItem.productId` deve usar `onDelete: Restrict`, nunca `Cascade`, e o item deve
guardar os snapshots de nome, SKU e preço previstos no contrato v1. Esta entrega
preserva os produtos e impede cascatas pela loja/categoria; a FK e os snapshots
dos itens de pedido deverão ser implementados junto da persistência de pedidos.

## Fronteira do adapter

O módulo `products` exporta `ProductRepository` para os futuros casos de uso.
Criação, leitura, listagem, arquivamento e alteração de preço exigem `storeId`.
Leitura individual retorna `null` para outra loja; mutações filtram ID e loja
na própria instrução SQL e retornam `false` quando não alteram nada.

O chamador deve resolver a loja pelo proprietário autenticado. O adapter não é
uma camada de autorização HTTP e esta entrega não adiciona endpoints.
Regras de ativação, categoria ativa e quantidade de capas pertencem aos futuros
casos de uso do catálogo. A listagem administrativa inclui arquivados quando não
recebe filtro de status; ela não deve ser usada diretamente como vitrine pública.

## Aplicação e testes

No backend, após `npm ci` e configuração de `DATABASE_URL`:

```text
npm run prisma:generate
npm run prisma:deploy
npm run typecheck
npm run build
npm test
```

Para os testes de banco, crie um banco **vazio e descartável** cujo nome comece com
`catalog_test_`. Exporte a URL separadamente; o runner nunca usa `DATABASE_URL`
como destino dos testes e não apaga nem recria bancos automaticamente.

```powershell
$env:PRODUCT_TEST_DATABASE_URL = 'mysql://USUARIO:SENHA@HOST:3306/catalog_test_catalogo'
npm.cmd run test:products:persistence
```

Cada execução requer um banco vazio novo. A suíte aplica as migrations anteriores,
insere loja e categoria profissional, aplica a migration do catálogo, verifica
preservação dos dados e reaplicação sem alterações. Exercita os índices,
`NOT NULL`, `UNIQUE`, `CHECK`, FKs, cascatas/restrições, escrita atômica de produto
com imagens, ordenação, precisão decimal, timestamp de preço, arquivamento e
isolamento por loja contra MySQL real. As fixtures do catálogo usam rollback;
o schema e as fixtures anteriores à migration permanecem no banco descartável.

`npm test` inclui os testes unitários do adapter e só executa a integração se a
variável dedicada estiver exportada. O comando específico de persistência falha
se a variável não estiver definida, evitando um resultado verde sem executar MySQL.

Validação executada em 26/09/2026: `typecheck` e `build` aprovados; suíte geral com
184 testes aprovados (integração omitida sem a variável); comando de persistência
com 11 cenários aprovados em MySQL 8.0.44 descartável, sem skips.
