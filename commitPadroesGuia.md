Guia de padrão de Commits para não se perder.

## 1. Os prefixos

O prefixo do commit serve para categorizar instantaneamente o tipo de mudança. Aqui estão os mais usados no dia a dia:

* **`feat`** (Feature): Adicionou uma **funcionalidade nova** para o usuário final.
  * *Exemplo:* `feat(auth): adiciona login via Google`
* **`fix`** (Correção): Consertou um **bug** no código.
  * *Exemplo:* `fix(carrinho): corrige cálculo duplicado do frete`
* **`docs`**: Mudança apenas na **documentação** (README, comentários, guias).
  * *Exemplo:* `docs: atualiza instruções de instalação no README`
* **`style`**: Formatação de código que **não altera a lógica** (espaços, ponto e vírgula, identação, lint).
  * *Exemplo:* `style(user): aplica regras do Prettier no model de usuário`
* **`refactor`**: Refatoração de código que **não corrige bugs nem adiciona features** (limpeza, melhoria de performance interna).
  * *Exemplo:* `refactor(api): extrai lógica de paginação para um helper`
* **`test`**: Adição ou correção de **testes**.
  * *Exemplo:* `test(checkout): adiciona testes unitários para o fluxo de pagamento`
* **`chore`**: Tarefas de manutenção, atualização de dependências, builds, ferramentas de CI/CD.
  * *Exemplo:* `chore(deps): atualiza versão do axios para 1.6.0`


## 2. Emojis nos Commits 🎨

Você pode adicionar emojis no começo das mensagens. Existe um padrão super famoso para isso chamado **Gitmoji** (criado pelo Carlos Cuesta), que padroniza um emoji para cada tipo de intenção no código. É a primeira coisa a se colocar quando se faz um commit seguindo o padrão de commits.

Visite este site para ver a lista completa e quando usar cada um: [Gitmoji](https://gitmoji.dev/)

**Exemplos**
* ✨ `feat(auth): :sparkles: adiciona login via Google`
* 🐛 `fix(carrinho): :bug: corrige cálculo duplicado do frete`
* 📚 `docs: :book: atualiza instruções de instalação no README`
* 🚀 `chore(deploy): :rocket: configura deploy automático na Vercel`
