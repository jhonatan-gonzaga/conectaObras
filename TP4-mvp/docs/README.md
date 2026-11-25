# Documentação do Conecta Obras

Os documentos estão agrupados por assunto. Para executar o aplicativo, consulte
o [README do MVP](../README.md) e o [guia do backend](../backend/README.md).
O [artigo em LaTeX](../../artigo/README.md) tem um guia próprio de figuras e compilação.

| Pasta | Conteúdo |
| --- | --- |
| [arquitetura](arquitetura/analise-codigo-padroes.md) | Análises de design, padrões e refatorações |
| [diagramas](diagramas/README.md) | Modelagem Draw.io, arquitetura interativa e fontes Graphviz |
| [loja](loja/contrato-api-v1.md) | Contratos, permissões, persistência e funcionalidades comerciais |
| [rastreabilidade](rastreabilidade/visao-geral.md) | Relação entre histórias de usuário e telas |
| [suporte](suporte/jornada-atendimento.md) | Jornada de atendimento e chamados |
| [testes](testes/relatorio-navegacao.md) | Relatórios de análise e verificação |
| [politicas](politicas/termos-uso.md) | Termos de uso e política de privacidade |
| [contribuicao](contribuicao/padroes-commits.md) | Convenções de contribuição |

## Arquitetura e design

- [Análise do código, componentes e padrões](arquitetura/analise-codigo-padroes.md).
- [Diagnóstico de design — item 5.3](arquitetura/diagnostico-design-5-3.md).
- [Refatorações do código](arquitetura/refatoracoes-codigo.md).
- [Refatoração da contratação com Facade](arquitetura/refatoracao-contratacao.md).
- [Diagramas e instruções de edição](diagramas/README.md).

Os diagnósticos e relatórios identificam os recortes históricos analisados. A
reorganização dos arquivos não atualiza suas conclusões nem os resultados registrados.

## Loja, catálogo e operação

- [Contrato da API — versão 1](loja/contrato-api-v1.md).
- [Cadastro e edição da loja](loja/cadastro-edicao.md).
- [Permissões de acesso do lojista](loja/permissoes-acesso.md).
- [Persistência das lojas](loja/persistencia-lojas.md).
- [Persistência do catálogo](loja/persistencia-catalogo.md).
- [API de promoções](loja/api-promocoes.md).
- [API de avaliações verificadas](loja/api-avaliacoes.md).
- [Pedidos e entregas](loja/pedidos-entregas.md).

## Rastreabilidade, suporte e testes

- [Visão geral da rastreabilidade](rastreabilidade/visao-geral.md).
- [Telas do cliente](rastreabilidade/telas-cliente.md).
- [Telas do profissional](rastreabilidade/telas-profissional.md).
- [Jornada de suporte](suporte/jornada-atendimento.md).
- [Relatório de análise e testes da navegação](testes/relatorio-navegacao.md).

As [capturas de tela](../prints/) e o [material de demonstração](../video/)
permanecem nas pastas próprias do MVP.

## Políticas e contribuição

- [Política de privacidade](politicas/politica-privacidade.md).
- [Termos de uso](politicas/termos-uso.md).
- [Padrões de commits](contribuicao/padroes-commits.md).

## Convenções de organização

- Use nomes em português, minúsculos, sem acentos e com palavras separadas por
  hífen, como `pedidos-entregas.md`.
- Coloque documentos relacionados na mesma pasta e acrescente o link neste índice.
- Reúna os arquivos de diagramas em `diagramas/`. Nomes técnicos de extensões e
  arquivos auxiliares de ferramentas são mantidos quando necessários.
- Use links relativos nos documentos e atualize as referências ao mover arquivos.
- Preserve os registros históricos e identifique o contexto de novas evidências.
