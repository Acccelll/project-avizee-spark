import { useEffect, useState } from "react";
import { Building2, Phone, Search } from "lucide-react";
import { FormModal } from "@/components/FormModal";
import { FormModalFooter } from "@/components/FormModalFooter";
import { FormSection } from "@/components/FormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { useCnpjLookup } from "@/hooks/useCnpjLookup";
import { useSubmitLock } from "@/hooks/useSubmitLock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface QuickAddSupplierModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (fornecedorId: string) => void;
  /** Pré-preenchimento opcional (ex.: fornecedor extraído do XML da NF-e). */
  defaults?: Partial<{
    nome_razao_social: string;
    nome_fantasia: string;
    cpf_cnpj: string;
    email: string;
    telefone: string;
  }>;
}

type TipoPessoa = "F" | "J";

const emptyForm = {
  nome_razao_social: "",
  nome_fantasia: "",
  cpf_cnpj: "",
  tipo_pessoa: "J" as TipoPessoa,
  email: "",
  telefone: "",
  contato: "",
};

/**
 * Cadastro mínimo de fornecedor disparado a partir de Pedido de Compra /
 * Cotação de Compra. Inclui lookup automático por CNPJ via `useCnpjLookup`.
 */
export function QuickAddSupplierModal({
  open,
  onClose,
  onCreated,
  defaults,
}: QuickAddSupplierModalProps) {
  const { saving, submit } = useSubmitLock({ errorPrefix: "Erro ao cadastrar fornecedor" });
  const { buscarCnpj, loading: cnpjLoading } = useCnpjLookup();
  const [form, setForm] = useState({ ...emptyForm });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (open && defaults) {
      setForm((prev) => ({ ...prev, ...defaults }));
      setIsDirty(true);
    }
  }, [open, defaults]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleCnpjLookup = async () => {
    const result = await buscarCnpj(form.cpf_cnpj);
    if (result) {
      setForm((prev) => ({
        ...prev,
        nome_razao_social: result.razao_social || prev.nome_razao_social,
        nome_fantasia: result.nome_fantasia || prev.nome_fantasia,
        email: result.email || prev.email,
        telefone: result.telefone || prev.telefone,
      }));
      setIsDirty(true);
    }
  };

  const reset = () => {
    setForm({ ...emptyForm });
    setIsDirty(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_razao_social.trim()) {
      toast.error("Nome / Razão Social é obrigatório");
      return;
    }
    await submit(async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .insert({
          nome_razao_social: form.nome_razao_social.trim(),
          nome_fantasia: form.nome_fantasia.trim() || null,
          cpf_cnpj: form.cpf_cnpj || null,
          tipo_pessoa: form.tipo_pessoa,
          email: form.email || null,
          telefone: form.telefone || null,
          contato: form.contato || null,
          ativo: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Fornecedor cadastrado!");
      onCreated(data.id);
      reset();
      onClose();
    });
  };

  return (
    <FormModal
      open={open}
      onClose={handleClose}
      title="Cadastro Rápido de Fornecedor"
      mode="create"
      size="md"
      isDirty={isDirty}
      confirmOnDirty
      createHint="Preencha os dados essenciais do fornecedor — refine o cadastro completo depois."
      footer={
        <FormModalFooter
          saving={saving}
          isDirty={isDirty}
          onCancel={handleClose}
          submitAsForm
          formId="quick-add-supplier-form"
          mode="create"
          primaryLabel="Cadastrar"
        />
      }
    >
      <form id="quick-add-supplier-form" onSubmit={handleSubmit} className="space-y-5">
        <FormSection icon={Building2} title="Identificação" noBorder>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.tipo_pessoa}
                onValueChange={(v) => update("tipo_pessoa", v as TipoPessoa)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="J">Jurídica</SelectItem>
                  <SelectItem value="F">Física</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{form.tipo_pessoa === "J" ? "CNPJ" : "CPF"}</Label>
              <div className="flex gap-1">
                <MaskedInput
                  mask="cpf_cnpj"
                  value={form.cpf_cnpj}
                  onChange={(v) => update("cpf_cnpj", v)}
                />
                {form.tipo_pessoa === "J" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    disabled={cnpjLoading}
                    onClick={handleCnpjLookup}
                    aria-label="Buscar CNPJ"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Razão Social / Nome *</Label>
            <Input
              value={form.nome_razao_social}
              onChange={(e) => update("nome_razao_social", e.target.value)}
              placeholder="Razão social ou nome do fornecedor"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Nome Fantasia</Label>
            <Input
              value={form.nome_fantasia}
              onChange={(e) => update("nome_fantasia", e.target.value)}
            />
          </div>
        </FormSection>

        <FormSection icon={Phone} title="Contato">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={(e) => update("telefone", e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Contato</Label>
              <Input
                value={form.contato}
                onChange={(e) => update("contato", e.target.value)}
                placeholder="Pessoa de contato no fornecedor"
              />
            </div>
          </div>
        </FormSection>
      </form>
    </FormModal>
  );
}