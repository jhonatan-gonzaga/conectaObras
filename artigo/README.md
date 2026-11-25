# Artigo do Conecta Obras

O arquivo [main.tex](main.tex) contém o texto do artigo, com referências em
[referencias.bib](referencias.bib) e formatação do modelo SBC.

## Estrutura

```text
artigo/
├── main.tex
├── referencias.bib
├── figuras/
│   ├── fig1 - state contratos.png
│   └── fig2 - facade contratacao.png
├── exemplos/
│   ├── figuras/
│   │   ├── fig1 - tirinha.jpg
│   │   ├── fig2 - articulacoes.jpg
│   │   └── tabela - selecao.jpg
│   └── referencias-modelo.bib
├── caption2.sty
├── sbc-template.sty
└── sbc.bst
```

Os arquivos `.sty` e `.bst` são dependências do modelo SBC. Seus nomes técnicos
foram mantidos para que os comandos LaTeX e BibTeX continuem encontrando-os.
`sbc-template.sty` utiliza `caption2.sty`.

## Figuras utilizadas

| Ordem no texto | Arquivo | Fonte editável |
| --- | --- | --- |
| Figura 1 | [fig1 - state contratos.png](figuras/fig1%20-%20state%20contratos.png) | [State dos contratos](../TP4-mvp/docs/diagramas/padrao-state-contratos.dot) |
| Figura 2 | [fig2 - facade contratacao.png](figuras/fig2%20-%20facade%20contratacao.png) | [Facade da contratação](../TP4-mvp/docs/diagramas/padrao-facade-contratacao.dot) |

Use o padrão `figN - descricao resumida.ext`, com uma ou duas palavras na
descrição, sem acentos. A numeração acompanha a ordem das figuras no texto.
Ao substituir ou renumerar uma figura, ajuste também o caminho em `main.tex`.
Os rótulos `\label` são usados pelas referências internas do texto.

Os exemplos de imagens e bibliografia distribuídos com o modelo SBC estão em
`exemplos/`. Eles foram preservados e não são utilizados pelo `main.tex` atual.
A tabela de comparação presente no artigo é escrita diretamente em LaTeX.

## Compilação

Requisitos: uma instalação LaTeX com `pdflatex`, BibTeX e `latexmk`, além dos
pacotes utilizados pelo modelo. A partir da raiz do repositório:

```sh
cd artigo
latexmk -pdf -interaction=nonstopmode -halt-on-error -outdir=build main.tex
```

O resultado será `artigo/build/main.pdf`. A pasta `build/` e os arquivos
auxiliares de compilação são ignorados pelo Git.

No Overleaf, carregue o conteúdo desta pasta e selecione `main.tex` como documento
principal. Preserve `figuras/` junto ao documento e use o compilador pdfLaTeX.

## Atualização dos diagramas

As fontes `.dot` ficam na [pasta única de diagramas](../TP4-mvp/docs/diagramas/README.md).
Com Graphviz instalado, execute a partir de `artigo/`:

```sh
dot -Tpng ../TP4-mvp/docs/diagramas/padrao-state-contratos.dot -o 'figuras/fig1 - state contratos.png'
dot -Tpng ../TP4-mvp/docs/diagramas/padrao-facade-contratacao.dot -o 'figuras/fig2 - facade contratacao.png'
```

Depois de editar uma fonte, gere novamente sua imagem e recompile o artigo para
conferir a figura no documento.

[Documentação do projeto](../TP4-mvp/docs/README.md) · [Início do repositório](../README.md).
