# LOJA-022 — Pedidos e entregas

A lista e o detalhe usam a mesma estrutura em `components/orders/OrdersScreen.tsx`.
`StoreOrdersScreen` configura a visão do lojista e `ClientOrdersScreen` configura
o acompanhamento do cliente. O visual adapta o HTML fornecido para React Native
e reutiliza `ProjectHeader`, o cabeçalho da tela inicial do cliente.

## Navegação

- Cliente: guia **Pedidos** na navegação inferior → lista → detalhe. Voltar no
  detalhe retorna à lista; voltar na lista retorna ao início. O perfil retorna
  à lista de pedidos.
- Lojista: dashboard, produtos ou promoções → guia **Pedidos**. As guias conectam
  painel, produtos, promoções e configurações. Voltar no detalhe retorna à lista;
  voltar na lista retorna ao dashboard, que consulta novamente os indicadores.
- As guias existentes do cliente continuam disponíveis. Os atalhos de lojas,
  carrinho, comprovante e recompra do HTML dependem de fluxos ainda ausentes no
  aplicativo e não são exibidos como botões sem destino.

## Consulta e dados

| Método | Rota, com prefixo `/api` | Acesso |
| --- | --- | --- |
| GET | `/store-orders?page=1&limit=10` | Lojista, loja resolvida pelo JWT |
| GET | `/store-orders/:id` | Lojista proprietário |
| GET | `/orders?page=1&limit=10` | Cliente, somente pedidos próprios |
| GET | `/orders/:id` | Cliente do pedido |

As consultas paginadas retornam `{ items, total, page, limit }`, ordenadas por
`createdAt DESC, id DESC`. Página começa em 1, limite padrão da API é 20 e máximo
é 100; as telas usam 10 itens. Total e itens são lidos na mesma transação com
`RepeatableRead`. A consulta legada `/store-orders` sem `page`/`limit` mantém a
resposta em array para compatibilidade.

Filtros: `status`, `from` e `to`. O cliente também usa `group=OPEN` (exclui
concluídos e cancelados) ou `group=COMPLETED`. `status` e `group` são mutuamente
exclusivos. A mudança de filtro ou período reinicia a paginação; uma página que
deixa de existir após atualização volta à última disponível. O período usa a
data de criação do pedido e rejeita datas inválidas/invertidas antes da consulta.

Cliente não escolhe `customerId` nem `storeId`. Pedidos de outro cliente retornam
404. A resposta do cliente omite reserva de estoque, IDs dos atores do histórico,
IDs internos de produtos e dados do cliente. Inclui nome e WhatsApp da loja para
contato, mesmo quando a loja deixa de estar ativa e o pedido permanece no histórico.

O detalhe mostra itens, quantidade, preço unitário, subtotal, desconto, total,
endereço, rastreio, transportadora, previsão e histórico real com status traduzido.
O selo de atraso vem de `isDelayed` da API, recalculado em cada leitura; entregas
concluídas ou canceladas deixam de exibir o atraso após atualização.

## Ações e concorrência

`allowedActions` é retornado pela API:

```json
{
  "orderStatuses": ["CANCELED"],
  "deliveryStatuses": ["IN_TRANSIT", "CANCELED"],
  "canEditDelivery": true
}
```

O backend calcula as opções pelas mesmas policies usadas nas alterações. A visão
do cliente retorna listas vazias e `canEditDelivery: false`, e não renderiza
controles de gestão. As rotas de alteração continuam exclusivas do lojista.

As transições e o salvamento de rastreio exigem confirmação. Uma trava síncrona
bloqueia o segundo toque, além do estado visual desabilitado durante a gravação.
Após sucesso, lista e detalhe são consultados novamente. Um `409` provoca recarga
do estado e aviso para revisar as novas opções, sem reenviar automaticamente a
alteração. Se a recarga falhar, os controles ficam bloqueados até uma leitura
bem-sucedida. Outros erros são exibidos com opção de nova consulta.

O formulário valida a previsão e envia o fim do dia no fuso do aparelho em ISO
UTC. O fuso é informado na tela; código e transportadora são aparados e limitados
a 191 caracteres. Uma previsão em branco é omitida do payload e mantém o valor
existente na API. Uma entrega nova exige ao menos um dado preenchido.

## Atualização

A lista e o detalhe atualizam a cada 15 segundos em primeiro plano, ao puxar para
atualizar ou ao retornar do segundo plano. Polling pausa durante gravação e quando
o aplicativo está em segundo plano. Consultas automáticas não se sobrepõem;
respostas antigas são descartadas após mudança de filtro, seleção ou desmontagem.
Rascunhos do formulário são preservados durante polling.

## Verificação

No frontend, executar `npm run typecheck` e `npm test -- --runInBand`.
Os testes de pedidos cobrem filtros, limites de datas, paginação e redução do
número de páginas, detalhe, todas as transições expostas, confirmação, duplo toque,
payload de previsão, atraso, erro, `409`, respostas fora de ordem, polling,
retorno do segundo plano, atualização manual e navegação pelos dois perfis.

Os testes de navegação verificam a atualização dos indicadores do dashboard ao
retornar de uma transição. No backend, executar `npm run build`,
`npm run typecheck` e `npm test`; há testes adicionais de paginação, permissões,
isolamento do cliente, grupos de status e ações calculadas.

A exportação `npx expo export --platform web --platform android` valida os dois
bundles. Não há nova migração nem variável de ambiente obrigatória. Teste físico
no Expo Go continua necessário para confirmar o comportamento no aparelho.

### Evidências Web

Capturas feitas com o bundle exportado e respostas de API **simuladas**, usando
dados fictícios. Comprovam a apresentação da UI; não representam teste integrado
com MySQL nem execução física no Android.

- [Lista do cliente, 390 px](../prints/loja-022/cliente-pedidos-web.png).
- [Detalhe do cliente, 320 px](../prints/loja-022/cliente-pedido-320-web.png).
- [Detalhe do lojista, 390 px](../prints/loja-022/lojista-pedido-web.png).
- [Formulário de rastreio do lojista](../prints/loja-022/lojista-rastreio-web.png).

Na validação desta implementação: 174 testes do frontend aprovados; 297 testes do
backend aprovados e 5 integrações opcionais de banco ignoradas, pois as variáveis
de banco descartável não foram configuradas. Build e typecheck passaram; bundles
Android e Web exportados. As medidas do cabeçalho foram conferidas no navegador
em 320 e 390 px, sem sobreposição entre voltar, logo e perfil.
