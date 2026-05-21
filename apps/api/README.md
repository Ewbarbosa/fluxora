# @fluxora/api

Baseline inicial da extração da API do Fluxora a partir do `lawmanager-api`.

## Objetivo desta etapa

Trazer a base técnica existente para dentro do monorepo do Fluxora sem reescrever regra de negócio crítica, especialmente o módulo financeiro.

## Estado atual

- código-base do backend copiado para `apps/api`
- módulo financeiro presente
- núcleo ativo reduzido para `auth`, `users`, `profile`, `tenant`, `finance`, `email`, `logs`, `limits`
- módulos herdados sem aderência ao Fluxora foram arquivados em `_archive/modules`
- schema Prisma já passou por uma primeira limpeza forte
- primeiro build da API já foi concluído com sucesso
- dependências do monorepo já foram instaladas de forma própria via `pnpm`
- Prisma Client já foi gerado localmente no `apps/api`
- lint do `apps/api` já passa sem erros
- schema Prisma foi limpo de resíduos de planos/assinaturas/webhooks herdados
- backend já suporta trial de 14 dias, free tier pós-trial e base de SSO com Google via `openid-client`
- backend está pronto para a próxima rodada de testes técnicos antes de entrar no `apps/web`

## Núcleo priorizado

O foco imediato desta extração é preservar e evoluir:
- `finance`
- `auth`
- `tenant`
- `users`
- `profile`
- `database`
- `common`

## SSO e trial já preparados

### Endpoints novos
- `GET /auth/sso/google`
- `GET /auth/sso/google/callback`
- `GET /limits/usage` agora devolve também `accessTier`, janela de trial e flags do plano

### Regras atuais de acesso
- novos workspaces criados via Google entram em `TRIAL` por 14 dias
- ao expirar, o workspace cai automaticamente para `FREE`
- limites do `FREE`:
  - 1 usuário
  - 100 lançamentos por mês
  - 10 categorias financeiras
  - sem relatórios avançados

### Variáveis de ambiente relevantes
- `GOOGLE_OIDC_CLIENT_ID`
- `GOOGLE_OIDC_CLIENT_SECRET`
- `GOOGLE_OIDC_REDIRECT_URI`
- `GOOGLE_OIDC_ISSUER`
- `FRONTEND_URL` ou `SSO_SUCCESS_REDIRECT_URL`

## Próximos passos

1. configurar credenciais reais do Google no ambiente
2. testar o callback SSO ponta a ponta com o frontend
3. expor no `apps/web` a tela/botão de login com Google
4. decidir quais endpoints entram como “relatórios avançados” além do resumo atual
5. revisar onboarding e copy do fluxo SSO/trial
