import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormModal } from "@/components/FormModal";
import { FinanceiroLancamentoForm } from "@/pages/financeiro/components/FinanceiroLancamentoForm";
import { useFinanceiroAuxiliares } from "@/pages/financeiro/hooks/useFinanceiroAuxiliares";
import { emptyLancamentoForm, type LancamentoForm } from "@/pages/financeiro/types";
import { supabase } from "@/integrations/supabase/client";
import { notifyError } from "@/utils/errorMessages";
import { logger } from "@/lib/logger";
import type { Cliente, Fornecedor } from "@/types/domain";
import {
  listClientesLookup,
  listFornecedoresLookup,
} from "@/services/importacao.service";

interface Props {
  open: boolean;
  onClose: () => void;
  prefill: Partial<LancamentoForm> | null;
  onSaved: () => void;
}

/**
 * Modal de "Novo Lançamento" embutido na página de Conciliação —
 * evita a navegação para /financeiro e mantém o usuário no fluxo de
 * conferência do extrato.
 */
export function NovoLancamentoInlineModal({ open, onClose, prefill, onSaved }: Props) {
  const aux = useFinanceiroAuxiliares();
  const [form, setForm] = useState<LancamentoForm>({ ...emptyLancamentoForm });
  const [saving, setSaving] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  useEffect(() => {
    if (!open) return;
    setForm({ ...emptyLancamentoForm, ...(prefill ?? {}) });
    void (async () => {
      try {
        const [cs, fs] = await Promise.all([
          listClientesLookup({ activeOnly: true }),
          listFornecedoresLookup({ activeOnly: true }),
        ]);
        setClientes(cs as unknown as Cliente[]);
        setFornecedores(fs as unknown as Fornecedor[]);
      } catch (err) {
        logger.warn("[conciliacao] falha ao carregar clientes/fornecedores:", err);
      }
    })();
  }, [open, prefill]);

  async function handleSubmit() {
    if (!form.descricao || !form.valor) {
      toast.error("Descrição e valor são obrigatórios");
      return;
    }
    if (!form.data_vencimento) {
      toast.error("Data de vencimento é obrigatória");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tipo: form.tipo,
        descricao: form.descricao,
        valor: form.valor,
        data_vencimento: form.data_vencimento,
        status: form.status === "vencido" ? "aberto" : form.status,
        forma_pagamento: form.forma_pagamento || null,
        banco: form.banco || null,
        cartao: form.cartao || null,
        cartao_id: form.cartao_id || null,
        cartao_fatura_id: form.cartao_fatura_id || null,
        cliente_id: form.cliente_id || null,
        fornecedor_id: form.fornecedor_id || null,
        conta_bancaria_id: form.conta_bancaria_id || null,
        conta_contabil_id: form.conta_contabil_id || null,
        data_pagamento: form.data_pagamento || null,
        observacoes: form.observacoes || null,
        origem: "manual",
        ativo: true,
        forma_pagamento_dados:
          form.forma_pagamento_dados && Object.keys(form.forma_pagamento_dados).length
            ? (form.forma_pagamento_dados as unknown as Record<string, string | number | boolean | null>)
            : null,
      };
      const { error } = await supabase.from("financeiro_lancamentos").insert([payload]);
      if (error) throw error;
      toast.success("Lançamento criado.");
      onSaved();
      onClose();
    } catch (err) {
      logger.error("[conciliacao] erro ao criar lançamento inline:", err);
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal open={open} onClose={onClose} title="Novo Lançamento" size="lg">
      <FinanceiroLancamentoForm
        form={form}
        mode="create"
        saving={saving}
        contasBancarias={aux.contasBancarias}
        contasContabeis={aux.contasContabeis}
        clientes={clientes}
        fornecedores={fornecedores}
        cartoes={aux.cartoes}
        setForm={setForm}
        onCancel={onClose}
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      />
    </FormModal>
  );
}