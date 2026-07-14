# 04 — Inventário Funcional

| Funcionalidade | Módulo | Criticidade | Casos de uso | Permissão |
|----------------|--------|-------------|--------------|-----------|
| Emissão de NF-e | `nfe` | Crítica | Autorizar, rejeitar, denegar | `fiscal_emissao` |
| Cancelamento (110111) | `nfe/eventos` | Crítica | Solicitar/homologar | `fiscal_emissao` |
| CC-e (110110) | `nfe/eventos` | Alta | Transmitir/homologar | `fiscal_emissao` |
| Inutilização | `nfe/eventos` | Média | Solicitar/homologar | `fiscal_emissao` |
| Manifestação do destinatário | `nfe/eventos` | Alta | Ciência, confirmação, recusa, desconhecimento | `fiscal_recebimento` |
| Distribuição DF-e | `nfe/eventos` | Alta | Consulta incremental, download XML | `fiscal_recebimento` |
| Recebimento (XML/lote) | `recebimento` | Crítica | Importar, dedup, conciliar, aprovar | `fiscal_recebimento` |
| Apuração tributária | `escrituracao` | Crítica | Consolidar, apurar, gerar livros, fechar | `fiscal_apuracao` |
| Central Fiscal / Dashboards | `operacional` | Alta | Indicadores, pendências, notificações | `fiscal_dashboard` |
| Certificados A1 | `operacional` | Crítica | Registrar, monitorar validade | `fiscal_certificados` |
| Homologação técnica | `homologacao` | Alta | E2E, carga, hardening | `fiscal_admin` |
| Compliance / versionamento legal | `compliance` | Alta | Registrar norma, artefato, tributo, mudança | `fiscal_compliance` |
| Reforma Tributária (coexistência) | `compliance` | Alta | Contexto de transição IBS/CBS/IS × ICMS/IPI/PIS/COFINS/ISS | `fiscal_compliance` |
| Platform / plugins | `platform` | Fundacional | Registrar novos documentos como plugin | `fiscal_admin` |

Permissões catalogadas em `src/modules/fiscal/operacional/services/permissoesCatalogo.ts`.
