---
name: Edição privilegiada (Admin/Financeiro)
description: Admin e Financeiro editam lançamentos/NFs em qualquer status via RPCs editar_*_admin que estornam baixas e auditam
type: feature
---
- Gate frontend: `useCanEditFinanceiroAvancado()` (papel `admin` OU `financeiro`).
- Gate backend: `public.can_edit_financeiro_avancado(uid)`; RPCs SECURITY DEFINER
  rejeitam com ERRCODE 42501 quem não tem o papel.
- RPCs: `editar_lancamento_financeiro_admin(id, payload jsonb, motivo)`,
  `editar_baixa_admin(baixa_id, payload, motivo)`, `editar_parcela_nf_admin(id, payload, motivo)`.
- Motivo é obrigatório (≥10 chars); registrado em `auditoria_logs` com snapshot before/after.
- Mudança em valor/forma_pagamento/cartao_id/data_vencimento de lançamento `pago|parcial`
  estorna baixas automaticamente (`estornar_baixa_financeira`) e reabre como `aberto`.
- Bypass da trigger `trg_lancamento_status_requer_baixa` via GUC transacional
  `avizee.admin_override='on'` setado por `set_config(..., true)` dentro da própria RPC.
- UI: `NotaFiscalForm` libera readOnly SEFAZ para entrada/saída; `FinanceiroLancamentoForm`
  libera STATUS_READONLY e exibe banner "Edição privilegiada"; `BaixaParcialDialog` e
  `FinanceiroDrawer.canBaixa` ignoram bloqueio de status.
- Motivo coletado pelo campo Observações no form de lançamentos (mínimo 10 chars).