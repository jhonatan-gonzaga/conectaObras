# LOJA-006 — cadastro e edição da loja

O lojista sem loja entra no cadastro pela navegação da LOJA-021. Quem já tem loja abre **Editar loja** pelo painel. O cadastro segue o novo layout em três etapas: dados da loja, localização e contato/horários dos sete dias, com revisão das pendências na última etapa. A edição usa uma tela própria, com seções de informações, endereço e atendimento.

**Salvar rascunho** persiste os dados pela API; ao reabrir, a tela consulta `GET /stores/me` e restaura os dados salvos. Não há salvamento automático das alterações: sair com mudanças não salvas exige confirmação de descarte. Lojas ativas e inativas continuam sujeitas à validação de cadastro completo ao salvar.

CNPJ, telefone/WhatsApp e CEP recebem máscaras somente na apresentação. O payload envia CNPJ e CEP sem pontuação, telefones com `+55`, UF em maiúsculas e horários locais `HH:mm`. Um dia fechado tem horários nulos e controles desabilitados. IDs de loja e proprietário não são enviados pelo formulário.

## Layouts e navegação

Os dois HTMLs fornecidos foram adaptados para componentes React Native, mantendo as máscaras e as regras da API. **Voltar** no cadastro retorna à etapa anterior e, na primeira etapa, à escolha de perfil. Na edição, retorna ao painel. As saídas de ambas as telas preservam a confirmação de descarte quando há alterações não salvas.

**Concluir Cadastro da Loja** valida o cadastro completo, salva e consulta as pendências antes de retornar ao painel; a ativação permanece uma ação explícita. **Salvar Alterações** confirma o salvamento e mantém a edição aberta.

Na edição, **Visão** abre o painel; **Pedidos** abre a lista de pedidos; **Catálogo** abre produtos ativos; **Vendas** lista pedidos concluídos. As listas retornam à tela de origem. **Minha conta** volta aos ajustes; **Visualizar Loja como Cliente** abre uma prévia somente de leitura dos dados salvos, sem trocar a persona ou publicar a loja.

**Buscar CEP** usa [ViaCEP](https://viacep.com.br/), preserva número/complemento e permite preenchimento manual em caso de falha. O logo usa `POST /stores/me/logo`, aceita JPG/PNG de até 5 MB e requer um rascunho já salvo. **Precisa de ajuda?** abre o formulário que cria uma solicitação real no suporte. **Mapa** abre a busca pelo endereço informado.

Capa, categoria da loja e redes sociais dos modelos não foram adicionadas: a API atual não persiste esses campos. O cabeçalho da edição usa um fundo decorativo e mostra o status real da loja; não apresenta selos de verificação fictícios.

A raiz do aplicativo passou a fornecer `SafeAreaProvider`, corrigindo o erro que impedia o carregamento da versão web.

## Ativação e API

A consulta autenticada `GET /stores/me/activation-readiness` retorna `{ allowed, pending }`, reutilizando a política de ativação e resolvendo a loja pelo usuário do JWT. Exige LOJISTA e não altera o status. O backend desta branch deve acompanhar a publicação do aplicativo para disponibilizar essa consulta.

A tela oferece **Ativar loja** somente quando os dados estão salvos, a validação local está completa e a API autoriza sem pendências. A ativação usa `PATCH /stores/me/status` e o backend revalida os requisitos. Erros preservam as alterações e permitem retry; pendências recebidas da API bloqueiam a ativação e aparecem na revisão e no campo correspondente.

Não foram adicionadas migrations nem variáveis de ambiente.

## Verificação automatizada

- Jest: 92 testes aprovados. Cobertura de validação, máscaras e payload, sete dias, retomada após salvar e reabrir, erros de carregamento/salvamento, retry, sucesso, fechamento de dias, pendências e rejeição da ativação, alterações não salvas e proteção das rotas de edição/prévia, navegação com retorno à origem, conclusão do cadastro, consulta de CEP, upload de logo e solicitação de suporte.
- Validação anterior do backend (implementação inicial da LOJA-006): 204 testes aprovados e dois testes de banco não executados. O backend não foi alterado nesta revisão visual. Testes HTTP de autenticação, papel, isolamento por proprietário e consulta de prontidão sem alteração de status, além da suíte existente.
- Nesta revisão: typecheck do aplicativo e exportação web aprovados; renderização conferida no Chromium em 390 px, com dados simulados e sem rolagem horizontal. A exportação Android também foi validada.
- Os testes de persistência com MySQL permanecem dependentes de um banco de teste configurado.

## Teste manual obrigatório — pendente

Não há aparelho conectado neste ambiente. Executar em Android/iOS antes de considerar a validação da história completa:

- Abrir cadastro/edição; digitar e colar CNPJ, telefones e CEP, verificando máscaras e teclado numérico.
- Com o teclado aberto, rolar até os últimos campos; avançar e voltar entre etapas sem perder dados ou ocultar controles.
- Abrir, selecionar e cancelar o seletor nativo de hora; verificar `HH:mm` local e fechamento posterior à abertura. Marcar **Fechado** e confirmar limpeza e bloqueio dos dois horários.
- Salvar, fechar/reabrir a tela e reiniciar o aplicativo; confirmar retomada dos dados salvos.
- Simular falha de rede ao carregar/salvar, verificar preservação dos dados e tentar novamente.
- Conferir erros junto aos campos, resumo de pendências e ausência de ativação enquanto houver pendências na API; completar, salvar e ativar com sucesso.
- Alterar um campo e tentar voltar, trocar perfil ou sair; conferir a confirmação de descarte.

A história usa seleção de hora, sem campo de data. A validação manual em aparelho não foi executada neste ambiente.
