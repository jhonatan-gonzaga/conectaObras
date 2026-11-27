# Persistencia de lojas (dependencia LOJA-001)

Os modelos e indices foram introduzidos em `20260924090000_add_store_profiles`.
Essa migration foi preservada: `StoreProfile.ownerId` referencia `users.id`, sem
duplicar o usuario; ownerId/CNPJ, storeId do endereco e storeId/dia dos horarios
possuem unicidade. As FKs removem os dependentes em cascata. Os indices compostos
cobrem status/nome e cidade/bairro; os indices unicos tambem cobrem as relacoes.

`20260924100000_store_persistence_constraints` adiciona CHECKs sem alterar dados,
tabelas de usuarios ou as migrations anteriores. Requer MySQL >= 8.0.16, versao
que passou a aplicar [CHECK constraints](https://dev.mysql.com/blog-archive/mysql-8-0-16-introducing-check-constraint/).

## Regras

- CNPJ e CEP recebidos pela API sao normalizados para 14 e 8 digitos. Ausencia ou
  texto vazio vira NULL, permitindo varios rascunhos sem CNPJ. SQL direto deve
  fornecer os digitos; CHECK rejeita valores formatados ou parciais.
- Dia fechado usa horas NULL. Dia aberto exige duas horas HH:mm, entre 00:00 e
  23:59, com fechamento posterior a abertura, inclusive em DRAFT.
- Fora de DRAFT, o banco exige nome, CNPJ e telefone. O servico valida o resultado
  final dentro da transacao, incluindo o CNPJ/telefone validos, endereco completo
  (rua, numero, bairro, cidade, UF e CEP) e ao menos um dia aberto. Descricao,
  WhatsApp, logo, complemento e coordenadas continuam opcionais.
- A completude entre tabelas e uma regra transacional do servico, nao um CHECK
  SQL. Futuros fluxos de ativacao/escrita devem chamar `validatePersistedStore`
  antes do commit. Escritas SQL diretas nao verificam endereco e dias cadastrados.

## Configuracao e verificacao

Configure `backend/.env` a partir de `.env.example`. O arquivo `.env` nao e
versionado. Credenciais com caracteres especiais precisam de URL encoding.
Use Node >= 20.12 para o runner operacional.

No MySQL local, prepare dois bancos **descartaveis**, com nomes iniciados por
`loja_test_`: um vazio e outro restaurado de um backup do banco atual, incluindo
`_prisma_migrations`. Nao aponte as variaveis de teste ao banco de trabalho.
Configure `STORE_TEST_EMPTY_DATABASE_URL` e `STORE_TEST_COPY_DATABASE_URL`.

Execute em `TP4-mvp/backend`:

```sh
npx prisma format
npx prisma validate
npx prisma generate
npm run typecheck
npm test
npm run test:stores:persistence
```

O runner aplica toda a cadeia com `prisma migrate deploy` em ambos os bancos.
Compara hashes dos dados existentes, testa unicidade, FKs, cascatas e CHECKs,
reverte apenas a nova migration, reaplica e repete as verificacoes. Os registros
de teste ficam em transacoes revertidas. As migrations ficam aplicadas aos bancos
descartaveis. Para repetir o cenario vazio, recrie esse banco; restaure novamente
a copia para repetir o mesmo ponto de partida. Nenhum teste se declara aprovado
se faltarem configuracao, conexao ou CHECKs efetivos.

Antes de aplicar em uma copia com lojas existentes, confira CNPJ/CEP normalizados,
campos obrigatorios em lojas fora de DRAFT e horarios consistentes. A migration
falha se houver dados invalidos: corrija-os explicitamente, sem apagar registros
ou preencher dados ficticios. MySQL faz commit implicito de DDL; uma falha pode
deixar parte dos CHECKs aplicada. Inspecione `SHOW CREATE TABLE` nas tres tabelas
e o historico Prisma antes de recuperar uma aplicacao parcial.

## Reversao operacional

`backend/prisma/operations/revert-store-persistence-constraints.sql` remove apenas
os quatro CHECKs da nova migration e preserva tabelas/dados/indices/FKs. Execute
com `prisma db execute --file prisma/operations/revert-store-persistence-constraints.sql --schema prisma/schema.prisma`
somente no banco escolhido para reversao. Para reaplicar o SQL:

```sh
npx prisma db execute --file prisma/migrations/20260924100000_store_persistence_constraints/migration.sql --schema prisma/schema.prisma
```

Esse ciclo temporario nao modifica `_prisma_migrations` e so volta a ficar alinhado
ao historico ao reaplicar o SQL. Nao use `migrate resolve --rolled-back` numa
migration bem-sucedida. Para desfazer permanentemente em um ambiente compartilhado,
versione uma nova migration de compensacao. Para uma falha parcial, remova somente
os CHECKs ja criados, corrija os dados e use `migrate resolve --rolled-back
20260924100000_store_persistence_constraints` antes de tentar `migrate deploy`.
