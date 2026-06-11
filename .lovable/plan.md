## Diagnóstico do "nada chega"

Logs `sefaz-distdfe` confirmam dois problemas independentes:

1. **Ambiente** — `empresa_config.ambiente_sefaz = 2` (homologação). SEFAZ responde cStat 137 "Nenhum documento localizado" porque homologação não recebe NF-e reais. Nada chegará enquanto não migrarmos para produção (`ambiente_sefaz = 1`).
2. **Busca retroativa quebrada** — o endpoint `NFeConsultaDest` (NFeConsultaNFDest.asmx) que adicionamos no prompt anterior foi **descontinuado pela SEFAZ em 2017**. O log mostra `cStat=""` e `xMotivo=""` — o WS sequer responde envelope SOAP válido. Hoje o único caminho oficial é `NFeDistribuicaoDFe` (cursor NSU) + `consChNFe` (consulta pontual por chave). Vou remover essa via.

Há também 2 NSU stuck em `000000000000000` na linha de produção; resetar/avançar manualmente é trivial.

## Resposta sobre paridade com TOTVS Processos Fiscais

Sim, é viável e a maior parte da infra já existe: `nfe_distribuicao` (32 colunas), cron DistDFe, manifestação do destinatário, importação XML, parser cStat. Falta a **camada de consulta** estilo portal — uma tela única com filtros ricos, grid com ações por linha e exportação. É o que esta fase entrega.

## Fase 1 — Portal de Consulta `/fiscal/portal`

Nova rota dedicada (não mexe em `/fiscal` nem em `/fiscal/distdfe-historico`, que viram visões específicas). Layout inspirado no print TOTVS:

```text
┌─ Filtros (sticky) ──────────────────────────────────────────────┐
│ Período [PeriodFilter] │ UF │ Status │ Manifestação            │
│ Série │ Nº inicial → final │ Chave de acesso (44d)              │
│ Papel: ●Destinatário ○Emissor ○Transportador                    │
│ CNPJ Emissor │ CNPJ Destinatário                                │
│ [Buscar]  [Limpar]  [Sincronizar SEFAZ]  [Exportar CSV]         │
└─────────────────────────────────────────────────────────────────┘
┌─ Grid (DataTableV2 + virtualização) ────────────────────────────┐
│ ☐ T M Série Nº DataEmissão Situação Tipo Emitente Dest. Total  │
│   ações: 👁 ver  ⤓ XML  📄 DANFE  ✉ e-mail  ⚑ manifestar      │
└─────────────────────────────────────────────────────────────────┘
```

### Backend (camada fina)

- **View `v_nfe_portal`** (security_invoker) sobre `nfe_distribuicao` + join leve com `notas_fiscais` (se chave bater) para enriquecer status interno. Já cobre os campos visíveis sem novo storage.
- **RPC `buscar_nfe_portal(filtros jsonb, p_limit int, p_offset int)`** retornando `{ rows, total }`. Aplica os filtros server-side (período por `dh_emissao`, ILIKE em emitente, status, manifestação, faixa de número, chave). RLS herda da empresa via `empresa_id` (Onda multi-tenant já cobriu `nfe_distribuicao`).
- **Sem nova tabela.** Nenhum CREATE TABLE; só view + RPC.

### Frontend

- `src/pages/fiscal/PortalFiscal.tsx` (nova) — composição de `AdvancedFilterBar` + `DataTableV2` + `useDataTablePrefs/Export`.
- `src/hooks/fiscal/usePortalFiscalQuery.ts` — wrapper de `useSupabaseCrud` chamando a RPC com server-side pagination/sort.
- Ações por linha reaproveitam serviços existentes:
  - **Ver XML** → drawer `NotaFiscalDrawer` (já existe).
  - **Baixar XML** → `nfe_distribuicao.xml_nfe` (Storage / coluna).
  - **DANFE PDF** → reusa edge `consultadanfe-proxy` se a NF estiver lá; fallback para "gerar a partir do XML" (Fase 1.1, fora de escopo agora — sinalizar botão como "em breve" se XML não tiver layout previsto).
  - **E-mail** → reusa pipeline `send-transactional-email` com template `nfe-autorizada`.
  - **Manifestar** → reabre `ManifestacaoDestinatarioDrawer` existente.
- Rota: `/fiscal/portal` (`PermissionRoute resource="faturamento_fiscal"`), entrada no menu lateral em "Fiscal → Portal NF-e".

### Limpeza da busca retroativa

- Remover ação `consultar-destinatario` de `supabase/functions/sefaz-distdfe/index.ts` (e helpers `montarConsNFeDest`, `endpointNFeDest`, `envelopeSoapDest`, `parseRetConsNFeDest`).
- Remover método `buscarNFeDestinatario` de `distdfe.service.ts` e o card "Busca Retroativa" de `DistDFeHistorico.tsx`.
- No lugar, manter apenas:
  - **Sincronizar SEFAZ** (já existe — DistDFe por NSU).
  - **Buscar por chave** (já existe — `BuscarPorChaveDialog`/consChNFe).
- Aviso em `mem/features/fiscal-consulta-por-chave.md` documentando que NFeConsultaDest está descontinuado e não deve ser reintroduzido.

### Migração para produção (operacional)

- Trocar `empresa_config.ambiente_sefaz` de `2` para `1` e `ambiente_padrao` para `producao`.
- Confirmar com você que o **A1 carregado no Vault é o certificado de produção do CNPJ 53.078.538/0001-85** antes de virar a chave. Sem isso, prod retorna cStat 280/281 (certificado inválido).
- Disparar `sync` manual em produção; validar que `nfe_distdfe_sync.ultimo_nsu` cresce e que linhas começam a popular `nfe_distribuicao`.

## Fora de escopo (futuras fases)

- Geração de DANFE PDF a partir do XML cru (renderer próprio) — fica como Fase 2 se você quiser independência do `consultadanfe-proxy`.
- Painel de Controle (KPIs por status/manifestação) e Monitoramento — já temos `FiscalDashboard` e `cron_health`; consolidação visual fica para outra fase.
- Regras de auto-manifestação por emitente (cadastros) — Fase 3.

## Entregáveis desta fase

1. Migration: view `v_nfe_portal` + RPC `buscar_nfe_portal`.
2. Edge function `sefaz-distdfe`: remoção do branch `consultar-destinatario` e helpers.
3. `src/services/fiscal/sefaz/distdfe.service.ts`: remover `buscarNFeDestinatario`.
4. `src/pages/fiscal/DistDFeHistorico.tsx`: remover card de busca retroativa.
5. `src/pages/fiscal/PortalFiscal.tsx`, `usePortalFiscalQuery.ts`, rota em `fiscal.routes.tsx`, entrada de menu.
6. UPDATE em `empresa_config` para ambiente=1 (somente após você confirmar A1 de produção).
7. Atualização da memória `fiscal-consulta-por-chave` e nova memória `fiscal-portal`.

## Verificação

- `/fiscal/portal` lista 0 linhas em homolog (esperado) e linhas reais após virada para prod.
- Filtros aplicam server-side; export CSV bate com a grid.
- Botão "Busca Retroativa" não existe mais.
- `sefaz-distdfe` não aceita mais `action=consultar-destinatario` (retorna 400).
