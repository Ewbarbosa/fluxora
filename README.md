# Fluxora

Monorepo inicial do Fluxora.

## Stack definida

- `apps/api` → NestJS + Prisma + PostgreSQL
- `apps/web` → Next.js
- `packages/types` → tipos compartilhados
- `packages/api-client` → client/contratos compartilhados
- workspace com `pnpm`
- orquestração com `turbo`

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
