# Diagramas do Conecta Obras

Esta pasta reúne os arquivos editáveis de modelagem, as fontes dos diagramas do
artigo e os artefatos da arquitetura de componentes.

| Arquivo | Uso |
| --- | --- |
| [modelagem-sistema.drawio](modelagem-sistema.drawio) | Arquivo principal de modelagem, com 13 páginas |
| [modelagem-sistema.drawio.bkp](modelagem-sistema.drawio.bkp) | Cópia de segurança preservada; não é o arquivo principal |
| [arquitetura-componentes.html](arquitetura-componentes.html) | Visualização interativa da arquitetura |
| [arquitetura-componentes.architecture.json](arquitetura-componentes.architecture.json) | Especificação da visualização interativa |
| [arquitetura-componentes.visual-check.json](arquitetura-componentes.visual-check.json) | Registro histórico da tentativa de verificação visual |
| [padrao-state-contratos.dot](padrao-state-contratos.dot) | Fonte Graphviz do padrão State nos contratos |
| [padrao-facade-contratacao.dot](padrao-facade-contratacao.dot) | Fonte Graphviz da Facade de contratação |

## Modelagem Draw.io

Abra `modelagem-sistema.drawio` no Draw.io/diagrams.net. O arquivo contém páginas
de componentes, estados, casos de uso, sequências, implantação, atividades e
arquitetura. Os nomes das páginas e os elementos dos diagramas foram preservados.
O backup foi mantido separadamente para permitir recuperação de versões anteriores.

## Arquitetura interativa

Abra `arquitetura-componentes.html` em um navegador. O HTML é autocontido. O JSON
de especificação permanece ao lado dele, com o mesmo nome-base.

O arquivo `arquitetura-componentes.visual-check.json` registra uma execução
anterior que ficou como `skipped`, com revisão visual pendente. O caminho absoluto
registrado é o do ambiente original; a movimentação não representa uma nova
validação nem altera esse registro histórico.

## Diagramas do artigo

Os arquivos `.dot` são as fontes editáveis. As imagens utilizadas pelo LaTeX
ficam na pasta de figuras do artigo e devem ser atualizadas quando essas fontes
forem modificadas. Consulte o README do artigo para os comandos de geração.

[Voltar ao índice da documentação](../README.md).
