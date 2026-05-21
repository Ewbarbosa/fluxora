# Fluxora — API extraction plan

## O que foi feito agora

- a base do `lawmanager-api` foi copiada para `apps/api`
- o módulo financeiro e seus módulos de suporte vieram junto como baseline de extração
- seeds do Lawmanager foram removidos e substituídos por placeholders neutros
- bootstrap inicial foi rebatizado para Fluxora no Swagger e no startup
- CORS aberto com `*` foi trocado por configuração via `CORS_ORIGIN`
- `contact`, `process` e `address` foram removidos do `AppModule`
- `dashboard`, `schedule`, `plans`, `subscriptions`, `billing`, `onboarding`, `logs`, `limits` e `email` também saíram do bootstrap principal nesta passada
- os módulos mortos (`address`, `contact`, `process`, `schedule`, `dashboard`) foram movidos para `_archive/modules`
- `billing`, `plans`, `subscriptions` e `onboarding` também foram arquivados fora do caminho ativo
- o módulo `finance` deixou de aceitar e manipular vínculos com `contact` e `process`
- o `schema.prisma` foi limpo para remover modelos e enums de contato, processo, endereço, agenda, bancos e Google Calendar
- foram adicionados `WorkspaceAccessTier`, `ExternalIdentity`, `SsoAuthorizationSession` e novos campos de trial/limites para suportar SSO e monetização básica
- o `auth` ganhou fluxo Google OIDC via `openid-client`, com `state`, `nonce` e PKCE explícitos no código
- o `limits` passou a entender trial de 14 dias + fallback automático para free tier
- o `finance` passou a aplicar limites de categorias, lançamentos mensais e bloqueio de relatórios avançados no free

## Módulos hoje presentes na extração

### Núcleo ativo no bootstrap atual
- `finance`
- `auth`
- `users`
- `profile`
- `tenant`
- `database`
- `common`

### Módulos ainda ativos no código
- `email`
- `logs`
- `limits`

### Módulos arquivados fora do caminho ativo
- `plans`
- `subscriptions`
- `billing`
- `onboarding`
- `dashboard`
- `schedule`
- `address`
- `contact`
- `process`

### Módulos já desalocados do caminho principal
- `contact`
- `process`
- `address`

### Módulos com alta chance de remoção física nas próximas passadas
- `schedule`
- `dashboard` (parte não financeira)
- `plans`
- `subscriptions`
- `billing`
- `onboarding`

## Dependências críticas do financeiro

O módulo `finance` hoje depende principalmente de:
- autenticação (`AuthGuard`)
- permissões (`PermissionsGuard`)
- `CustomRequest` com `tenantId`
- Prisma/database
- nenhuma dependência restante de `contact` e `process` na camada de API do financeiro

## Próximas decisões técnicas

1. o schema Prisma será limpo de `contact` e `process` já na próxima passada ou em uma refatoração isolada?
2. `billing`, `plans` e `subscriptions` entram só depois do MVP?
3. `logs` e `email` ficam como dependência do auth ou serão simplificados?

## Próxima execução recomendada

### Passo 1
Mapear por código as dependências reais do `finance` para separar:
- obrigatório agora
- opcional
- jurídico demais para ficar

### Passo 2
Refinar os módulos ainda ativos que carregam vocabulário herdado (`limits`, `logs`, `auth`, `users`).
- branding principal já neutralizado em `auth`, `users`, `email` e bootstrap
- permissões mortas de `contacts/processes/schedules` removidas do request typing
- dependências sem uso ativo (`@nestjs/schedule`, `googleapis`, `stripe`) removidas do `apps/api/package.json`
- mensagens de limits neutralizadas para linguagem de workspace, sem assinatura/plano
- tipagem central endurecida em `auth`, `users`, `logs`, `limits` e `profile`

### Passo 3
Decidir se `logs` e `email` ficam no MVP técnico ou serão simplificados ainda mais.
- backend já está em condição melhor para testes reais antes da entrada em `apps/web`

### Passo 4
Definir um schema mínimo neutro do Fluxora para:
- tenant
- user
- profile/permissão
- financialCategory
- financialTransaction
- cliente opcional (se mantido)

## Meta da próxima iteração

Chegar em um backend que ainda rode o financeiro, já com SSO/trial/free operacionais no backend e pronto para encaixar o `apps/web` sem gambiarra mística.

## Validação executada

- `prisma validate --schema apps/api/prisma/schema.prisma` → schema válido
- `prisma db push --schema ./prisma/schema.prisma` → banco `fluxora` sincronizado com trial/SSO/free tier
- `prisma generate` no `apps/api` → concluído
- `pnpm --filter @fluxora/api build` → concluído
- `pnpm --filter @fluxora/api lint:ci` → concluído sem erros
- bootstrap em `PORT=3334` → API subiu com as novas rotas `/auth/sso/google` e `/auth/sso/google/callback`
- `GET /health` em `http://localhost:3334/health` → ok
- `POST /auth/signin` com `admin@fluxora.local` → ok
- `GET /limits/usage` com token JWT → retorno inclui `accessTier`, trial e limites agregados
- `GET /auth/sso/google` sem credenciais Google configuradas → falha controlada com mensagem explícita, sem quebrar o bootstrap

## Observação operacional

- a muleta inicial de `node_modules` herdado do `lawmanager-api` foi removida
- o monorepo já recebeu instalação própria via `pnpm install`
- o Prisma Client foi gerado localmente no `apps/api`
- o build voltou a funcionar sem dependência do projeto original
