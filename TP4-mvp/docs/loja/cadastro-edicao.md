# LOJA-006 — cadastro e edição da loja

O lojista sem cadastro completo entra no cadastro pela navegação da LOJA-021. Quem concluiu o cadastro abre **Editar loja** pelo painel. O cadastro segue o novo layout em três etapas: dados da loja, localização e contato/horários dos sete dias. Os campos preenchidos corretamente recebem marcação verde, sem uma etapa de resumo antes do envio. A edição usa uma tela própria, com seções de informações, endereço e atendimento.

O cadastro não oferece salvar rascunho nem entrar antecipadamente no painel. **Concluir Cadastro da Loja** exige todos os dados obrigatórios e aprovação da API. Dados salvos pela versão anterior são restaurados, mas o cadastro incompleto continua na tela de cadastro. Falhas de consulta também não liberam acesso ao painel. Sair com mudanças não salvas exige confirmação de descarte; a edição igualmente exige cadastro completo ao salvar.

CNPJ, telefone/WhatsApp e CEP recebem máscaras somente na apresentação. O payload envia CNPJ e CEP sem pontuação, telefones com `+55`, UF em maiúsculas e horários locais `HH:mm`. Um dia fechado tem horários nulos e controles desabilitados. IDs de loja e proprietário não são enviados pelo formulário.

## Layouts e navegação

Os dois HTMLs fornecidos foram adaptados para componentes React Native, mantendo as máscaras e as regras da API. **Voltar** no cadastro retorna à etapa anterior e, na primeira etapa, à escolha de perfil. Na edição, retorna ao painel. As saídas de ambas as telas preservam a confirmação de descarte quando há alterações não salvas.

**Concluir Cadastro da Loja** valida o cadastro completo, salva e consulta as pendências antes de retornar ao painel; a ativação permanece uma ação explícita. **Salvar Alterações** confirma o salvamento e mantém a edição aberta.

A edição reutiliza `ProfessionalHeader`, com a foto da conta autenticada e retorno ao painel. **Abrir perfil** abre a conta e retorna aos ajustes. Não há botão de mensagens nem barra inferior de Visão/Pedidos/Catálogo/Vendas/Ajustes nesta tela. As listas continuam acessíveis pelo painel. **Visualizar Loja como Cliente** abre uma prévia somente de leitura dos dados salvos, sem trocar a persona ou publicar a loja.

**Buscar CEP** usa [ViaCEP](https://viacep.com.br/), preserva número/complemento e permite preenchimento manual em caso de falha. **Precisa de ajuda?** abre o formulário que cria uma solicitação real no suporte. **Mapa** abre a busca pelo endereço informado.

## Imagens de capa e fundo

São duas imagens independentes: a **capa** quadrada usa o campo legado `logoUrl`; o **fundo** do banner usa `backgroundUrl`. Ambas podem ser selecionadas no cadastro novo, mesmo antes de a loja existir. A seleção aceita JPG/PNG de até 5 MB, mostra a prévia e conta como alteração não salva. O seletor pode ser cancelado sem descartar a imagem anterior; falhas permitem tentar novamente.

**Concluir Cadastro da Loja** e **Salvar Alterações** persistem primeiro o perfil completo e depois as imagens selecionadas em `POST /stores/me/cover` e `POST /stores/me/background`. Uma falha de envio mantém a imagem pendente para retry e não anuncia sucesso nem conclui a navegação. Imagens que já foram salvas não são reenviadas. As imagens persistidas reaparecem ao reabrir ajustes e prévia; seleções ainda não salvas são descartadas ao confirmar a saída.

A rota antiga `POST /stores/me/logo` permanece como alias da capa. As três rotas exigem JWT e LOJISTA, resolvem a loja pelo usuário autenticado e ignoram `ownerId`/`storeId` enviados no multipart. Atualizar uma imagem não sobrescreve a outra. O formulário comercial não permite alterar URLs de imagem por mass assignment.

O [seletor de imagens do Expo](https://docs.expo.dev/versions/latest/sdk/imagepicker/) abre diretamente no toque, sem solicitar acesso amplo à galeria antes de escolher uma foto. A capa admite recorte quadrado; o fundo admite recorte 3:1 no Android e preserva o original no iOS, cujo editor nativo recorta somente em quadrado. URLs locais de uploads em localhost são exibidas pelo mesmo endereço configurado para a API; fontes externas e prévias locais são preservadas. Erros de carregamento apresentam um indicador em vez de uma imagem vazia.

Categoria da loja e redes sociais continuam sem campos na API. O banner mostra o status real da loja e não apresenta selos de verificação fictícios.

A raiz do aplicativo passou a fornecer `SafeAreaProvider`, corrigindo o erro que impedia o carregamento da versão web.

## Ativação e API

A consulta autenticada `GET /stores/me/activation-readiness` retorna `{ allowed, pending }`, reutilizando a política de ativação e resolvendo a loja pelo usuário do JWT. Exige LOJISTA e não altera o status. O backend desta branch deve acompanhar a publicação do aplicativo para disponibilizar essa consulta.

A tela de edição oferece **Ativar loja** somente quando os dados estão salvos, a validação local está completa e a API autoriza sem pendências. A ativação usa `PATCH /stores/me/status` e o backend revalida os requisitos. Erros preservam as alterações e permitem retry; pendências recebidas da API bloqueiam a ativação e aparecem junto ao campo correspondente no cadastro; a revisão de ativação permanece na edição.

A migration `20261010090000_add_store_background_image` adiciona `backgroundUrl` nullable, preservando imagens existentes. Antes de iniciar esta versão do backend, executar `npm run prisma:generate` e `npm run prisma:deploy` no pacote `backend`, com o banco configurado. Nenhuma variável de ambiente nova foi adicionada; o aplicativo continua usando `EXPO_PUBLIC_API_URL`.

## Verificação automatizada

- Aplicativo: `npm test -- --runInBand --testTimeout=15000`, com 101 testes aprovados em 11 suítes; `npm run typecheck` aprovado. Os testes cobrem cadastro completo, restrições de navegação, validação/payload, seleção das duas imagens antes da criação da loja, multipart nativo/web, cancelamento/erros do seletor, preservação de campos e de imagens pendentes, retry sem duplicar uploads, avatar da conta no cabeçalho compartilhado e ausência de mensagens/barra inferior nos ajustes.
- Backend: `npm test` com 211 testes aprovados em 18 suítes e dois testes de banco não executados; `npm run typecheck` e `npm run build` aprovados. A integração HTTP usa um repositório em memória e arquivos temporários removidos ao terminar. Verifica autenticação/papel, isolamento entre donos, capa/fundo independentes, compatibilidade com a rota antiga, leitura das imagens pela URL retornada, limites de arquivo e erros. Testes do repositório Prisma verificam atualização de somente uma imagem por vez, filtrada pelo proprietário.
- A migration não foi aplicada a um banco real neste ambiente; a persistência com MySQL continua dependente de banco de teste configurado.

## Teste manual obrigatório — pendente

Não há aparelho conectado neste ambiente. Executar em Android/iOS antes de considerar a validação da história completa:

- Abrir cadastro/edição; digitar e colar CNPJ, telefones e CEP, verificando máscaras e teclado numérico.
- Com o teclado aberto, rolar até os últimos campos; avançar e voltar entre etapas sem perder dados ou ocultar controles.
- Abrir, selecionar e cancelar o seletor nativo de hora; verificar `HH:mm` local e fechamento posterior à abertura. Marcar **Fechado** e confirmar limpeza e bloqueio dos dois horários.
- Concluir o cadastro, fechar/reabrir e reiniciar o aplicativo; confirmar acesso ao painel. Verificar que cadastros antigos incompletos retornam ao cadastro.
- Simular falha de rede ao carregar/salvar, verificar preservação dos dados e tentar novamente.
- Conferir marcação verde dos campos corretos e erros junto aos campos; confirmar ausência de rascunho, resumo e acesso antecipado ao painel. Na edição, ativar somente depois da aprovação da API.
- Alterar um campo ou selecionar uma imagem e tentar voltar, trocar perfil ou sair; conferir a confirmação de descarte.
- Selecionar capa e fundo em cadastro novo e ajustes; conferir galeria, recorte, cancelamento e prévias. Salvar, fechar/reabrir e verificar ambas as imagens. Simular falha de envio de uma imagem e repetir sem reenviar a outra.
- Confirmar foto da conta no cabeçalho e retorno após editar o perfil; conferir ausência do botão de mensagens e dos cinco atalhos inferiores nos ajustes.

A história usa seleção de hora, sem campo de data. A validação manual em aparelho não foi executada neste ambiente.
