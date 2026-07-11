## Sprint 6 — Importação OFX/CNAB + Dashboard de Conciliação

Encerradas Sprints 1–5 (matching 1:1, N:1/1:N, baixa automática, regras e auto-aprovação). Esta sprint fecha o ciclo com ingestão automatizada de extratos e visão gerencial.

### Objetivo
Permitir que o usuário importe extratos bancários (OFX e CNAB 240) diretamente na tela de Conciliação e acompanhe indicadores em um dashboard consolidado.

### Entregas

1. **Parser OFX/CNAB (frontend)**
   - `src/services/conciliacao/ofxParser.ts` — parse SGML/XML OFX → `ExtratoLinhaInput[]`.
   - `src/services/conciliacao/cnab240Parser.ts` — parse CNAB 240 (segmentos E/T) → `ExtratoLinhaInput[]`.
   - Detecção de layout por extensão + heurística de cabeçalho.

2. **RPC de importação idempotente**
   - `conciliacao_importar_extrato(p_conta_id, p_periodo_inicio, p_periodo_fim, p_linhas jsonb)`:
     - Cria/reaproveita `conciliacao_extratos` no período.
     - Insere linhas em `conciliacao_extrato_linhas` com dedupe por `hash(fitid|data|valor|memo)`.
     - Retorna `{extrato_id, inseridas, duplicadas}`.

3. **UI de upload**
   - Botão "Importar extrato" em `ConciliacaoV2.tsx` abre `ImportarExtratoDialog` (drag&drop + seleção de conta).
   - Preview das primeiras 10 linhas antes de confirmar.
   - Toast com resumo (X novas / Y duplicadas).

4. **Dashboard de Conciliação**
   - Rota `/financeiro/conciliacao/dashboard`.
   - RPC `conciliacao_dashboard_kpis(p_empresa_id, p_periodo_inicio, p_periodo_fim)` retorna:
     - Total linhas / conciliadas / pendentes / divergentes.
     - % auto-aprovadas × manuais.
     - Ticket médio e volume por conta bancária.
   - Componentes: 4 `SummaryCard`s + gráfico de barras (recharts) por conta + tabela de contas ranqueadas.

5. **Auditoria**
   - Nova coluna `conciliacao_extratos.origem` (`manual|ofx|cnab240`).
   - Log em `auditoria_eventos` para importações.

### Detalhes técnicos
- Parsers 100% client-side; upload de arquivos NÃO passa por Storage (privacidade).
- Hash das linhas em SHA-256 (crypto.subtle) para dedupe determinística.
- Dashboard usa `useQuery` com `staleTime: 60_000` e `PeriodFilter` (contrato de períodos).
- Gates: G3 (RLS por empresa), G4 (idempotência via hash), G5 (tipos em `src/types/domain.ts`), G7 (UI responsiva + a11y).

### Fora de escopo
- CNAB 400 (legado, adicionar sob demanda).
- Conciliação preditiva com ML.
- Exportação PDF do dashboard (Sprint 7).
