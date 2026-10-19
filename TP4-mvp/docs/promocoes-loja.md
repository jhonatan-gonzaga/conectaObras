# LOJA-015 — Gestão de promoções

Os dois protótipos HTML foram adaptados para Expo/React Native em
`front-end/src/pages/lojista/StorePromotionsScreen.tsx` e
`front-end/src/pages/lojista/StorePromotionFormScreen.tsx`.

## Navegação e comportamento

- Painel da loja → cartão ou aba Promoções → lista → criar/editar → voltar à lista.
- A lista conecta Pedidos, Produtos, Configurações e Painel às telas existentes.
- O catálogo existente passa a ser acessível pelo navegador e conecta de volta a Promoções.
- Voltar funciona pelo cabeçalho e botão físico nas telas de promoções. O formulário pede confirmação para descartar alterações.
- Busca por nome da oferta, produto ou SKU; filtros Todas, Vigentes, Agendadas, Expiradas, Rascunhos e Inativas.
- Publicação, salvamento como rascunho, ativação e desativação exigem confirmação. Erros preservam o formulário para nova tentativa.

O formulário escolhe exatamente uma regra: percentual, abatimento fixo ou preço direto.
A prévia usa centavos e arredondamento monetário, com preço final estritamente positivo
e inferior ao preço de tabela. Percentuais devem ser maiores que zero e menores que 100,
com até duas casas decimais. Rascunhos também exigem produto, desconto e datas válidos.

Todos os campos de data/hora representam **Brasília (BRT, UTC−3)**, inclusive em aparelhos
configurados para Manaus ou outro fuso. O payload converte esses campos para UTC.
O fim do período é exclusivo: uma oferta terminando às 10h permite outra começando às 10h.
Apenas regras publicadas com períodos sobrepostos para o mesmo produto são bloqueadas;
rascunhos não reservam vigência. Ativação e edição repetem a validação no servidor.

O destaque de oferta e o preço riscado aparecem somente enquanto a promoção está vigente.
A expiração é calculada pelas datas, mesmo se o registro persistido ainda tiver status
`ACTIVE`. Atualizar, puxar a lista ou retornar ao app recarrega os dados; o relógio visual
também é atualizado a cada 30 segundos. Ofertas expiradas precisam de nova vigência no
formulário antes de reativar. O preço de tabela do produto permanece armazenado em `Product.price`.

## API e banco

Todas as rotas exigem JWT e papel `LOJISTA`; a loja é obtida pelo usuário autenticado.

| Método | Rota | Finalidade |
| --- | --- | --- |
| GET | `/stores/me/promotions` | Todos os estados da loja |
| GET | `/stores/me/promotions/:id` | Detalhes para edição |
| POST | `/stores/me/promotions` | Criar |
| PUT | `/stores/me/promotions/:id` | Editar todos os campos |
| PATCH | `/stores/me/promotions/:id/status` | `ACTIVE` ou `CANCELED` |

O POST/PUT recebe `name`, `productId`, `discountType` (`PERCENTAGE`, `FIXED`, `DIRECT`),
`discountValue` numérico, `startsAt`, `endsAt` com timezone explícito e `status`
(`DRAFT` ou `ACTIVE`). O campo legado `discountPct` é calculado pela API;
enviá-lo junto com outra regra é rejeitado. Produtos devem estar ativos e pertencer à loja.
O status `CANCELED` é apresentado como Inativa, permitindo reativação após validação.

A escrita usa transação e bloqueio da linha da loja (`FOR UPDATE`) antes de consultar
campanhas concorrentes. Assim, as rotas de criação, edição e ativação serializam a
checagem de sobreposição por loja.

A nova migração `20261018210000_promotion_discount_rules` adiciona tipo e valor da regra,
preenchendo promoções antigas a partir de `discountPct`. Nenhuma migração anterior foi alterada.
As datas já existiam no schema. Registros legados sem produto/datas exigem completar
esses campos ao editar ou reativar.

Com `backend/.env` configurado, executar em `TP4-mvp/backend` antes de usar as telas:

```sh
npm run prisma:deploy
npm run prisma:generate
```

Não há variáveis de ambiente novas. A migração foi criada, mas não foi aplicada a um
banco nesta entrega; os testes de promoções usam dependências simuladas.

## Validação e evidências

- Frontend: suíte Jest completa, testes de formulário, prévia, payload, filtros,
  expiração após refresh, confirmação, erro/retry da API e navegação.
- Backend: suíte `node:test`, DTOs, isolamento por dono, permissões HTTP,
  datas, descontos, edição e sobreposição nas operações de escrita.
- `npm run typecheck` nos dois pacotes; `npm run build` no backend.
- Exportação web do Expo e conferência em Chromium headless, viewport de 430×932,
  com respostas da API simuladas. Não houve erro de execução no navegador.
- Dois testes preexistentes de persistência MySQL são ignorados sem
  `PRODUCT_CATEGORIES_TEST_DATABASE_URL` e `PRODUCT_TEST_DATABASE_URL`.
- Não foi realizado teste em aparelho Android/iOS nem teste de concorrência em MySQL real.

Screenshots usam apenas dados fictícios:

- [Lista](../prints/LOJA-015/01-lista.png)
- [Formulário e prévia](../prints/LOJA-015/02-formulario.png)
- [Vigência e ativação](../prints/LOJA-015/03-vigencia.png)

Também foram corrigidos bloqueios já presentes na branch: imports de tipos do catálogo,
ligação das telas de produtos ao navegador, referências antigas do upload da loja e
transformação de pacotes Expo no Jest. Os testes de ajustes usam os rótulos acessíveis
e o nome real da vitrine para verificar o retorno ao painel.
