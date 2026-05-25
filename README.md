# Fluxora

Monorepo inicial do Fluxora.

## Stack definida

- `apps/api` → NestJS + Prisma + PostgreSQL
- `apps/web` → Next.js
- `packages/types` → tipos compartilhados
- `packages/api-client` → client/contratos compartilhados
- workspace com `pnpm`
- orquestração com `turbo`

## Como rodar localmente

Este monorepo usa `pnpm`. Se `pnpm` não estiver disponível no shell, use `corepack`, que já vem com Node moderno.

```bash
corepack enable
corepack pnpm install
corepack pnpm --filter @fluxora/api start:dev
corepack pnpm --filter @fluxora/web dev
```

Se você executar `npm install` dentro de `apps/api` ou `apps/web`, vai cair em comportamento inconsistente de workspace. O caminho certo é instalar pela raiz do monorepo com `pnpm`.

## Direção técnica

A decisão foi manter backend e frontend como aplicações separadas, com deploys independentes, mas dentro de um mesmo monorepo para facilitar:
- reaproveitamento do módulo financeiro do Lawmanager
- compartilhamento de tipos e configs
- organização da base desde o início

## Próximos passos

1. inicializar `apps/api` com base no núcleo do `lawmanager-api`
2. inicializar `apps/web` com base no `lawmanager-frontend`
3. extrair o módulo financeiro como núcleo do MVP
4. remover acoplamentos desnecessários com o domínio jurídico
