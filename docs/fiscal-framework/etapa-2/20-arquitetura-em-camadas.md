# 20 · Arquitetura em camadas

A arquitetura definitiva do Framework Fiscal do AVIZEE adota **6 camadas**
com fluxo de dependência estritamente descendente. Camadas superiores conhecem
apenas contratos das inferiores; camadas inferiores **não conhecem** as
superiores (Dependency Inversion).

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. ERP AVIZEE (UI React + services/*)                       │
│    Consumer. Chama a Fachada fina. Não conhece SEFAZ.       │
└────────────────────────────┬────────────────────────────────┘
                             │  DTO
┌────────────────────────────▼────────────────────────────────┐
│ 2. Fiscal Module (Fachada / API pública do framework)       │
│    edges fiscal-nfe / fiscal-events / fiscal-dfe /          │
│    fiscal-cert / fiscal-cron  +  src/services/fiscal/*      │
│    Traduz DTO ERP ↔ comandos de aplicação. Autoriza (RBAC). │
└────────────────────────────┬────────────────────────────────┘
                             │  Command / Query
┌────────────────────────────▼────────────────────────────────┐
│ 3. Application Layer (Use Cases / Orquestradores)           │
│    AutorizarNFe, ConsultarProtocolo, CancelarNFe,           │
│    EmitirCCe, InutilizarNumeracao, SincronizarDFe,          │
│    Manifestar, ImportarXML, ExportarXML, ReprocessarLote.   │
│    Orquestra Domain + Infra. Gerencia idempotência,         │
│    transação lógica, retry policy, correlação.              │
└────────────────────────────┬────────────────────────────────┘
                             │  Domain Contracts
┌────────────────────────────▼────────────────────────────────┐
│ 4. Domain Layer (Fiscal Core + Modules por documento)       │
│    Entidades: NotaFiscal, Evento, DistribuicaoNSU.          │
│    VOs: ChaveAcesso, Cnpj, Cpf, Uf, Ambiente, Protocolo.    │
│    Regras: numeração, dígito verificador, CFOP × operação,  │
│    janela cancelamento (24h), sequência de eventos, cStat.  │
│    Plugins IFiscalDocumentModule (nfe, nfce, cte, mdfe...). │
│    Puro: sem I/O, sem Deno, sem Supabase.                   │
└────────────────────────────┬────────────────────────────────┘
                             │  Ports
┌────────────────────────────▼────────────────────────────────┐
│ 5. Infrastructure Layer (Adapters / Engines / Cross)        │
│    XML Engine, Signature Engine (XMLDSig+C14N), Schema      │
│    Validator (XSD), SOAP Client, Transport (fetch mTLS),    │
│    Certificate Manager, Endpoint Registry, Queue (pgmq),    │
│    Cache, Audit Sink, Logger Sink, Clock, Idempotency Store.│
│    Implementa as portas do Domain. Depende de Deno,         │
│    Postgres, Storage, Vault.                                │
└────────────────────────────┬────────────────────────────────┘
                             │  HTTPS + mTLS
┌────────────────────────────▼────────────────────────────────┐
│ 6. External Services                                        │
│    SEFAZ estaduais, SVAN, SVRS, Ambiente Nacional,          │
│    prefeituras (NFS-e), Receita (SPED/eSocial futuros),     │
│    proxy mTLS (contorno à limitação Deno/rustls no AN).     │
└─────────────────────────────────────────────────────────────┘
```

## Regras invioláveis

1. **Domain não importa Infrastructure.** Depende de portas (`I*`), não de fetch, Deno, Supabase.
2. **Application não fala HTTP nem SOAP.** Delega ao SOAP Client via porta.
3. **Fiscal Module (fachada) não contém regra fiscal.** Traduz DTO e chama Application.
4. **ERP não importa Fiscal Core direto.** Sempre pela fachada — permite trocar transporte, mover para edge, adicionar cache sem alterar telas.
5. **External Services não devolvem exceção para cima.** Adapter converte falha em `FiscalResult.error` tipado.

## Por que não CQRS estrito, hexagonal puro ou microserviços?

- **CQRS estrito**: não há assimetria de leitura/escrita relevante no volume atual (< 10k NF/mês por tenant). Adotar seria overkill; usamos separação leve `Command` × `Query` no Application Layer sem event sourcing.
- **Hexagonal puro**: Domain-como-hexágono é adotado (Ports & Adapters); não usamos o léxico completo (primary/secondary ports) para evitar ruído — só Ports.
- **Microserviços**: cada documento fiscal como serviço isolado inflaria custo operacional na Lovable/Deno edge. Escolhemos **modular monolith de edges** — 5 edges canônicas (`fiscal-*`), separação por bounded context, mesma base de código.

## Justificativas (resumo)

| Decisão | Razão |
|---|---|
| 6 camadas explícitas | Facilita teste unitário do Domain sem Deno; permite substituir transport quando/se o AN aceitar mTLS nativo |
| Fachada edge separada do Application | Permite reuso do Application em CLI de testes, worker de reprocessamento e futuros triggers de banco |
| Plugin por documento no Domain | NF-e/NFC-e/CT-e/MDF-e/NFS-e podem entrar sem tocar Application |
| Adapter mTLS externalizado | Deno/rustls não fecha handshake com o AN (ver `mem/tech/sefaz-mtls-transporte.md`) |
| Sem event sourcing | `fiscal_auditoria` já cobre rastreabilidade legal; ES seria complexidade sem ganho |