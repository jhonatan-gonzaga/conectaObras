# Conecta Obras

Aplicativo para conectar clientes, profissionais da construção e lojas de materiais,
com contratação de serviços, pedidos, entregas e atendimento de suporte.

**Tecnologias:** TypeScript, Expo/React Native, NestJS, Prisma e MySQL.

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| [TP4-mvp/front-end](TP4-mvp/front-end/) | Aplicativo móvel |
| [TP4-mvp/backend](TP4-mvp/backend/) | API, migrations e seeds |
| [TP4-mvp/tests](TP4-mvp/tests/) | Testes do aplicativo; os testes da API ficam em [backend/test](TP4-mvp/backend/test/) |
| [TP4-mvp/docs](TP4-mvp/docs/) | Documentação por assunto |
| [TP4-mvp/prints](TP4-mvp/prints/) e [video](TP4-mvp/video/) | Capturas e material de demonstração |
| [artigo](artigo/) | Artigo em LaTeX, referências e figuras |

## Como executar

Requisitos: nvm, Node.js na versão definida em [.nvmrc](.nvmrc), npm e MySQL com o banco
`COI` criado. A partir da raiz do repositório, prepare a API:

```sh
nvm install
nvm use
cd TP4-mvp/backend
npm ci
cp .env.example .env
```

Configure `DATABASE_URL` e `JWT_SECRET` no `.env`, conforme o
[exemplo do backend](TP4-mvp/backend/.env.example). Depois execute:

```sh
npm run db:setup
npm run start:dev
```

`db:setup` gera o cliente Prisma, aplica as migrations e cadastra as categorias.
A API usa `http://localhost:3000/api`. Em outro terminal, na raiz, inicie o aplicativo:

```sh
cd TP4-mvp/front-end
nvm use
npm ci
npm start
```

Use o QR Code no Expo Go com o celular e o computador na mesma rede. O app detecta
o host do Expo; para outra URL da API, configure `EXPO_PUBLIC_API_URL` conforme o
[exemplo do frontend](TP4-mvp/front-end/.env.example). Para abrir no navegador, use
`npm run web`.

## Verificações

Execute os comandos na pasta de cada pacote:

| Pacote | Comandos |
| --- | --- |
| `TP4-mvp/backend` | `npm run typecheck`, `npm test`, `npm run build` |
| `TP4-mvp/front-end` | `npm run typecheck`, `npm test` |

O [schema Prisma](TP4-mvp/backend/prisma/schema.prisma) descreve o banco de dados.
Os testes de persistência usam bancos descartáveis configurados no ambiente.

## Documentação

| Assunto | Documentos |
| --- | --- |
| Arquitetura e design | [Análise do código](TP4-mvp/docs/arquitetura/analise-codigo-padroes.md), [diagnóstico 5.3](TP4-mvp/docs/arquitetura/diagnostico-design-5-3.md), [refatorações](TP4-mvp/docs/arquitetura/refatoracoes-codigo.md), [contratação com Facade](TP4-mvp/docs/arquitetura/refatoracao-contratacao.md) |
| Loja e acesso | [Contrato da API](TP4-mvp/docs/loja/contrato-api-v1.md), [cadastro e edição](TP4-mvp/docs/loja/cadastro-edicao.md), [permissões](TP4-mvp/docs/loja/permissoes-acesso.md) |
| Persistência | [Lojas](TP4-mvp/docs/loja/persistencia-lojas.md), [catálogo](TP4-mvp/docs/loja/persistencia-catalogo.md) |
| Operação comercial | [Promoções](TP4-mvp/docs/loja/api-promocoes.md), [avaliações](TP4-mvp/docs/loja/api-avaliacoes.md), [pedidos e entregas](TP4-mvp/docs/loja/pedidos-entregas.md) |
| Rastreabilidade | [Visão geral](TP4-mvp/docs/rastreabilidade/visao-geral.md), [cliente](TP4-mvp/docs/rastreabilidade/telas-cliente.md), [profissional](TP4-mvp/docs/rastreabilidade/telas-profissional.md) |
| Suporte e testes | [Jornada de atendimento](TP4-mvp/docs/suporte/jornada-atendimento.md), [relatório de navegação](TP4-mvp/docs/testes/relatorio-navegacao.md) |
| Políticas | [Termos de uso](TP4-mvp/docs/politicas/termos-uso.md), [privacidade](TP4-mvp/docs/politicas/politica-privacidade.md) |
| Contribuição | [Padrões de commits](TP4-mvp/docs/contribuicao/padroes-commits.md) |

Os relatórios preservam os resultados e recortes históricos que analisaram.

## Diagramas

Os arquivos estão em [docs/diagramas](TP4-mvp/docs/diagramas/). Abra a
[modelagem do sistema](TP4-mvp/docs/diagramas/modelagem-sistema.drawio) no Draw.io
(13 páginas) ou a [arquitetura interativa](TP4-mvp/docs/diagramas/arquitetura-componentes.html)
no navegador. O backup, a especificação JSON e as fontes Graphviz estão na mesma
pasta. O [registro visual](TP4-mvp/docs/diagramas/arquitetura-componentes.visual-check.json)
é histórico e permanece com revisão pendente.

## Artigo

O texto está em [main.tex](artigo/main.tex), com bibliografia em
[referencias.bib](artigo/referencias.bib). As figuras seguem o padrão
`figN - descricao resumida.ext` em [artigo/figuras](artigo/figuras/), na ordem de
aparição no texto; os exemplos do modelo SBC ficam em [artigo/exemplos](artigo/exemplos/).
Mantenha os nomes dos arquivos `.sty` e `.bst`, necessários à formatação.

Com pdfLaTeX, BibTeX e `latexmk` instalados, compile a partir da raiz:

```sh
cd artigo
latexmk -pdf -interaction=nonstopmode -halt-on-error -outdir=build main.tex
```

O resultado será `artigo/build/main.pdf`. Para editar no Overleaf, carregue a pasta
`artigo/` e selecione `main.tex` como documento principal. Após alterar as fontes
[State](TP4-mvp/docs/diagramas/padrao-state-contratos.dot) ou
[Facade](TP4-mvp/docs/diagramas/padrao-facade-contratacao.dot), gere a imagem com
`dot -Tpng arquivo.dot -o 'artigo/figuras/figN - descricao.png'` e ajuste o caminho no `.tex`.

## Ferramentas de IA usadas

Codex, Figma Maker e Manus.
