# Orquestracao da contratacao

Os aceites de candidatura e de solicitacao direta delegam a
`ContractCreationService`, uma fachada com duas operacoes:

- `acceptApplication(userId, applicationId)` valida o cliente e o anuncio,
  aceita a candidatura, recusa as concorrentes e marca o anuncio como contratado.
- `acceptDirectRequest(userId, directRequestId)` valida o profissional e a
  solicitacao pendente, depois marca a solicitacao como aceita.

Cada operacao abre uma unica transacao e reutiliza a criacao de contrato com
status `PENDING_START`, o historico inicial e a consulta de retorno. A candidatura
gera uma conversa; a solicitacao direta vincula ao contrato suas conversas
existentes. O calculo do valor acordado foi preservado. A fachada reutiliza
`contractInclude` e `ContractWithRelations`, definidos em `contract.include.ts`,
para acompanhar o formato integrado pela task de includes: historico ordenado
por data decrescente e somente a ultima mensagem de cada conversa. Nao ha uma
copia local do include na fachada.

`NotificationsService.create()` e `ConversationsService.create()` recebem o
cliente da transacao quando chamados dentro de uma unidade de trabalho.
`ConversationsService.attachDirectRequestToContract()` exige esse cliente.
Assim, uma falha de historico, conversa ou notificacao rejeita o callback da
transacao de aceite; esses colaboradores nao abrem transacoes independentes.

`ContractsService` tambem reutiliza o servico de notificacoes. A recuperacao de
conversas ausentes foi movida para `ConversationsService.ensureForContracts()`.
As transicoes de contratos existentes continuam delegadas a
`ContractStatusPolicyService`, inclusive a conclusao pelo envio de avaliacao.

`ContractCreationModule` exporta a fachada para `ApplicationsModule` e
`DirectRequestsModule`. Os modulos de notificacoes e conversas exportam seus
servicos, sem depender dos modulos consumidores. A orquestracao permanece na
camada de aplicacao NestJS/Prisma; esta extracao nao cria um dominio independente
do ORM nem altera o schema, os endpoints ou as regras de aceite.

## Validacao

No diretorio `TP4-mvp/backend`, execute:

```sh
npm test
npm run typecheck
npm run build
```

Os testes cobrem os dois aceites, permissoes, estado pendente, valores nulos e
zero, historico inicial, destinatarios das notificacoes, vinculo de conversas,
uso do cliente transacional e propagacao de falhas. Os dois aceites tambem sao
verificados contra o include compartilhado, incluindo historico e ultima
mensagem. Tambem verificam a injecao
dos modulos NestJS e preservam os testes da politica de status e da avaliacao.

A persistencia e simulada nos testes. A propagacao de erros ao callback e
verificada, mas o rollback e a concorrencia em um MySQL real nao sao exercitados.
