# 5.3 — Identificação dos problemas de design no Conecta Obras

## Recorte e evidências

Este diagnóstico examina o **projeto implementado**, principalmente o fluxo de contratos do backend. Para explicar os problemas que motivaram State e Facade, usa as revisões anteriores a cada refatoração: `b034e0e` para transições de contrato e `8a00fce` para os dois aceites de contratação. São recortes históricos distintos, não uma única versão inicial do sistema. O estado atual foi conferido na branch `refactor/padroes-codigo` a partir do commit `74c0790`. Os caminhos abaixo são relativos a `TP4-mvp/`.

| Critério | Evidência no projeto | Consequência para uma alteração | Situação atual |
| --- | --- | --- | --- |
| Alto acoplamento | Em `b034e0e`, `ContractsController.updateStatus` chamava `ContractStatusPolicyService.assertCanUpdate` e depois `ContractsService.updateStatus`; ambos precisavam conhecer a regra de status e consultar o contrato. | Alterar uma transição exigia conferir controlador, política e serviço para entender a decisão efetiva. | Resolvido nesse fluxo: o controlador delega ao serviço, que consulta uma política única. |
| Baixa coesão | Em `8a00fce`, `ApplicationsService.accept` e `DirectRequestsService.accept` validavam a origem, mudavam estados, criavam contrato e histórico, coordenavam conversas e notificavam usuários. | Cada método reunia decisões de candidatura ou solicitação com a montagem comum do contrato. | Reduzida nos serviços de origem: os aceites delegam a `ContractCreationService`. A fachada ainda coordena várias operações porque esse é o caso de uso dela. |
| Duplicação de código | Em `8a00fce`, os dois aceites continham chamadas próprias a `tx.contract.create` e `tx.contractStatusHistory.create` com o status inicial `PENDING_START`. | Uma mudança no contrato ou no histórico inicial precisava ser repetida nos dois caminhos. | Resolvida no recorte: `ContractCreationService.createContract` contém um ponto de criação de cada registro. |
| Dificuldade de manutenção | Em `b034e0e`, a política tinha mapas separados por ator, enquanto `ContractsService.assertStatusTransition` tinha outro mapa de transições. A requisição precisava passar pelas duas verificações. | A regra efetiva era a interseção dos mapas; uma atualização parcial poderia produzir comportamento divergente. | Resolvida nesse fluxo pela política de estados, coberta por `backend/test/contract-status-policy.service.spec.ts`. |
| Dificuldade de extensão | Para acrescentar uma transição em `b034e0e`, era necessário revisar permissões por ator e transições no serviço. No código atual, `front-end/src/services/api.ts` ainda reúne contratos HTTP de autenticação, catálogo, loja, serviços, contratos e suporte. | A evolução dos fluxos antigos exigia alterações em vários lugares; no cliente móvel, novos domínios continuam ampliando um módulo central. | Parcial: State concentra as transições, mas uma nova transição ainda exige atualizar o estado correspondente e testes. O cliente HTTP continua concentrado. |
| Dependências excessivas | Em `8a00fce`, os serviços de aceite precisavam conhecer Prisma, conversas, notificações e a montagem do contrato. No código atual, `front-end/src/services/api.ts` importa APIs de Expo, React Native e tipos de vários domínios, além de servir de entrada para telas diferentes. | Os serviços de origem conheciam detalhes de colaboradores da contratação; no app, alterações em domínios distintos passam pelo mesmo módulo. | A fachada removeu dos serviços de origem a montagem do contrato, mas não eliminou suas outras dependências. A concentração do cliente HTTP permanece. |

## Localização e limites dos achados

- **Transições antes de State:** `backend/src/modules/contracts/contracts.controller.ts`, `contract-status-policy.service.ts` e `contracts.service.ts` em `b034e0e`. A autorização por ator e o mapa do serviço eram duas fontes de decisão. A implementação atual está em `backend/src/modules/contracts/states/` e é usada por `ContractsService.updateStatus` e `createReview`.
- **Aceites antes de Facade:** `backend/src/modules/applications/applications.service.ts` e `backend/src/modules/direct-requests/direct-requests.service.ts` em `8a00fce`. O mesmo par de gravações de contrato e histórico aparecia uma vez em cada serviço. Hoje, ambos delegam a `backend/src/modules/contracts/contract-creation.service.ts`; a fachada conserva uma transação por aceite e reutiliza `contract.include.ts`.
- **Ponto ainda aberto no aplicativo:** `front-end/src/services/api.ts` tem 712 linhas na revisão examinada e exporta um único objeto `api` usado por telas de diferentes perfis. O tamanho é um sinal de concentração de responsabilidades, **não** uma medida isolada de acoplamento ou de defeitos. A dependência compartilhada é observável nas importações das telas.

Para conferir os dois recortes históricos sem alterar arquivos:

```sh
git show b034e0e:TP4-mvp/backend/src/modules/contracts/contract-status-policy.service.ts
git show b034e0e:TP4-mvp/backend/src/modules/contracts/contracts.service.ts
git show 8a00fce:TP4-mvp/backend/src/modules/applications/applications.service.ts
git show 8a00fce:TP4-mvp/backend/src/modules/direct-requests/direct-requests.service.ts
```

Este item identifica problemas e seus efeitos plausíveis sobre mudanças no código. Não mede tempo de manutenção, complexidade ciclomática, desempenho ou incidência de falhas. As refatorações e a comparação antes/depois pertencem aos itens 5.4 e 5.5; os arquivos e testes atuais permitem verificá-las sem tratar problemas históricos como defeitos ainda presentes.
