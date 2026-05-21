# ADR 0001 — Stack e estrutura inicial do Fluxora

## Status
Aceito

## Contexto

Fluxora nasce a partir do módulo financeiro do Lawmanager.
A análise técnica mostrou que já existe uma base relevante em:
- NestJS + Prisma no backend
- Next.js no frontend
- módulo financeiro funcional com recorrência, parcelamento, resumo e notificações

O objetivo é acelerar o lançamento sem reescrever regra de negócio crítica.

## Decisão

O Fluxora adotará:
- monorepo com `pnpm`
- orquestração com `turbo`
- `apps/api` para backend NestJS
- `apps/web` para frontend Next.js
- `packages/*` para compartilhados

Backend e frontend permanecem aplicações separadas, com deploys independentes.

## Motivos

1. maximiza reaproveitamento do Lawmanager
2. evita reescrita prematura do backend
3. preserva separação clara entre API e frontend
4. facilita crescimento organizado
5. permite compartilhar tipos, config e client ao longo da evolução

## Opções descartadas

### Estrutura separada fora de monorepo
Foi descartada como solução principal porque mantém mais atrito operacional e duplicação estrutural no médio prazo.

### Next.js full-stack
Foi descartada porque exigiria reescrever parte importante da base existente e aumentaria o risco de atrasar o projeto sob a ilusão de simplificação.

## Consequências

### Positivas
- base mais organizada desde o início
- melhor DX para compartilhados
- deploy desacoplado
- caminho claro para extração do núcleo financeiro

### Custos
- setup inicial um pouco mais cuidadoso
- CI/CD precisará considerar workspace
- migração do código do Lawmanager deve ser feita com critério
