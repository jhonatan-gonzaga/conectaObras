# Persona de Suporte

Implementação da jornada de atendimento descrita na [persona de Suporte](https://github.com/jhonatan-gonzaga/projeto-pratico-es/blob/main/TP1/especificacao/2_design-thinking.md#33-persona-de-suporte), no [C4 de componentes](https://github.com/jhonatan-gonzaga/projeto-pratico-es/blob/main/TP2/Conecta-Obra-Itacoatiara/projeto-e-arquitetura/5-c4-componentes.md#16-painel-de-suporte-supportdashboard) e na [rastreabilidade](https://github.com/jhonatan-gonzaga/projeto-pratico-es/blob/main/TP2/Conecta-Obra-Itacoatiara/projeto-e-arquitetura/7-rastreabilidade.md#5-painel-de-suporte-administrativo).

## Fluxo

- `SUPORTE` entra diretamente na Central de suporte. O cadastro público e a troca de perfil não concedem esse papel.
- Clientes, profissionais e lojistas abrem **Meus chamados** pelo perfil da conta. Podem criar chamados, consultar o próprio histórico e trocar mensagens enquanto o chamado estiver ativo.
- Agentes de suporte consultam a fila por status, abrem o detalhe, respondem por texto, imagem ou áudio, mudam o status e solicitam continuação no WhatsApp.
- O histórico registra criação, mensagens, mudanças de status e solicitação de mudança de canal com o autor e a data. Conteúdo de mensagem fica na conversa; o log guarda somente a ação e o tipo.

## Autorização e estados

| Recurso | Cliente, profissional ou lojista | Suporte |
| --- | --- | --- |
| Criar chamado, listar os próprios | Sim | Sim |
| Ler ou responder chamado próprio | Sim | Sim |
| Ler ou responder qualquer chamado | Não | Sim |
| Consultar fila, alterar status, solicitar WhatsApp | Não | Sim |

Chamados seguem `OPEN → IN_REVIEW → RESOLVED`; o agente pode devolver `IN_REVIEW → OPEN` ou reabrir `RESOLVED → IN_REVIEW`. A atualização compara o estado anterior dentro de transação. Chamados resolvidos não aceitam novas mensagens até a reabertura. IDs de outros usuários retornam 404.

Imagens e áudios usam os endpoints de upload autenticados já existentes. O envio da mensagem aceita apenas URLs da origem da API dentro de `/uploads/images/` ou `/uploads/audio/`. O botão de WhatsApp abre um link `wa.me` com o telefone da conta e registra a solicitação; não há integração com a API comercial do WhatsApp nem importação automática de conversas externas.

## Rotas

Todas usam o prefixo `/api` e JWT.

| Método | Rota | Acesso |
| --- | --- | --- |
| POST | `/support-tickets` | Qualquer conta autenticada |
| GET | `/support-tickets/my` | Próprios chamados |
| GET | `/support-tickets/:id` | Dono ou suporte |
| POST | `/support-tickets/:id/messages` | Dono ou suporte |
| GET | `/support-tickets?status=OPEN&page=1&limit=20` | Suporte |
| PATCH | `/support-tickets/:id/status` | Suporte |
| POST | `/support-tickets/:id/whatsapp` | Suporte |

## Provisionamento

Depois de aplicar a migração nova e criar uma conta comum, um operador com acesso ao ambiente do backend pode executar:

```bash
cd TP4-mvp/backend
npm run support:provision -- agente@exemplo.com identificacao-do-operador
```

O comando promove a conta existente em transação e grava e-mail, papel anterior, operador e data em `support_role_grants`. Repetir para uma conta já promovida não cria outro registro. A conta precisa entrar novamente para receber o papel novo no JWT.

A migração `20261106120000_support_persona` adiciona mensagens, logs de atendimento e concessões de papel. Nenhuma migração aplicada foi alterada.
