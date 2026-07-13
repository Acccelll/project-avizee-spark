# Módulo Fiscal — AVIZEE Framework Fiscal

Infraestrutura base (Etapa 4). Segue arquitetura em 6 camadas de `docs/fiscal-framework/etapa-2/20-arquitetura-em-camadas.md`.

## Estrutura

```
src/modules/fiscal/
  core/                 → bootstrap, container, tipos primitivos
  domain/entities/      → entidades puras
  application/
    dto/                → DTOs
    contracts/          → interfaces (portas)
  infrastructure/
    repositories/       → adaptadores Supabase
    config/             → runtime config + endpoint registry
    certificates/       → metadados de certificados
    events/             → barramento interno
    queue/              → filas assíncronas
    cache/              → cache in-memory
    audit/              → fiscal_auditoria
    logging/            → logger padronizado
  shared/               → utilitários
```

## Restrições Etapa 4

- Nenhuma operação fiscal real (SEFAZ, XML, assinatura, emissão).
- Serviços em `src/services/fiscal/` seguem em produção (estrangulamento — ADR-016).
