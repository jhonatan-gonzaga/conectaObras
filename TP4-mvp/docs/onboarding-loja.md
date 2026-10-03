# LOJA-006 — cadastro e edição da loja

O lojista sem loja entra no cadastro pela navegação da LOJA-021. Quem já tem loja abre **Editar loja** pelo painel. O formulário tem quatro etapas: dados comerciais, endereço, horários dos sete dias e revisão das pendências.

**Salvar rascunho** persiste os dados pela API; ao reabrir, a tela consulta `GET /stores/me` e restaura os dados salvos. Não há salvamento automático das alterações: sair com mudanças não salvas exige confirmação de descarte. Lojas ativas e inativas continuam sujeitas à validação de cadastro completo ao salvar.

CNPJ, telefone/WhatsApp e CEP recebem máscaras somente na apresentação. O payload envia CNPJ e CEP sem pontuação, telefones com `+55`, UF em maiúsculas e horários locais `HH:mm`. Um dia fechado tem horários nulos e controles desabilitados. IDs de loja e proprietário não são enviados pelo formulário.

## Ativação e API

A consulta autenticada `GET /stores/me/activation-readiness` retorna `{ allowed, pending }`, reutilizando a política de ativação e resolvendo a loja pelo usuário do JWT. Exige LOJISTA e não altera o status. O backend desta branch deve acompanhar a publicação do aplicativo para disponibilizar essa consulta.

A tela oferece **Ativar loja** somente quando os dados estão salvos, a validação local está completa e a API autoriza sem pendências. A ativação usa `PATCH /stores/me/status` e o backend revalida os requisitos. Erros preservam as alterações e permitem retry; pendências recebidas da API bloqueiam a ativação e aparecem na revisão e no campo correspondente.

Não foram adicionadas migrations nem variáveis de ambiente.

## Verificação automatizada

- Jest: 68 testes aprovados. Cobertura de validação, máscaras e payload, sete dias, retomada após salvar e reabrir, erros de carregamento/salvamento, retry, sucesso, fechamento de dias, pendências e rejeição da ativação, alterações não salvas e proteção da rota de edição.
- Backend: 204 testes aprovados e dois testes de banco não executados. Testes HTTP de autenticação, papel, isolamento por proprietário e consulta de prontidão sem alteração de status, além da suíte existente.
- Typecheck dos dois pacotes, build do backend e exportação do bundle Android pelo Expo aprovados.
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

A história usa seleção de hora, sem campo de data. Não há evidência manual ou captura de aparelho anexada.
