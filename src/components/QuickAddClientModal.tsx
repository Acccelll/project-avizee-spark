import { useState } from "react";
import { Building2, MapPin, Phone, User } from "lucide-react";
import { FormModal } from "@/components/FormModal";
import { FormModalFooter } from "@/components/FormModalFooter";
import { FormSection } from "@/components/FormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { useCnpjLookup } from "@/hooks/useCnpjLookup";
import { useViaCep } from "@/hooks/useViaCep";
import { useSubmitLock } from "@/hooks/useSubmitLock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search } from "lucide-react";

interface QuickAddClientModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (clienteId: string) => void;
}

type TipoPessoa = "F" | "J";

const emptyForm = {
  nome_razao_social: "",
  nome_fantasia: "",
  cpf_cnpj: "",
  tipo_pessoa: "J" as TipoPessoa,
  inscricao_estadual: "",
  email: "",
  telefone: "",
  celular: "",
  contato: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
};

export function QuickAddClientModal({ open, onClose, onCreated }: QuickAddClientModalProps) {
  const { saving, submit } = useSubmitLock({ errorPrefix: "Erro ao cadastrar cliente" });
  const { buscarCnpj, loading: cnpjLoading } = useCnpjLookup();
  const { buscarCep, loading: cepLoading } = useViaCep();
  const [form, setForm] = useState({ ...emptyForm });
  const [isDirty, setIsDirty] = useState(false);

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
        inscricao_estadual: result.inscricao_estadual || prev.inscricao_estadual,
        email: result.email || prev.email,
        telefone: result.telefone || prev.telefone,
        logradouro: result.logradouro || prev.logradouro,
        numero: result.numero || prev.numero,
        complemento: result.complemento || prev.complemento,
        bairro: result.bairro || prev.bairro,
        cidade: result.municipio || prev.cidade,
        uf: result.uf || prev.uf,
        cep: result.cep || prev.cep,
      }));
      setIsDirty(true);
    }
  };

  const handleCepLookup = async () => {
    const result = await buscarCep(form.cep);
    if (result) {
      setForm((prev) => ({
        ...prev,
        logradouro: result.logradouro || prev.logradouro,
        bairro: result.bairro || prev.bairro,
        cidade: result.localidade || prev.cidade,
        uf: result.uf || prev.uf,
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
        .from("clientes")
        .insert({
          nome_razao_social: form.nome_razao_social,
          nome_fantasia: form.nome_fantasia || null,
          cpf_cnpj: form.cpf_cnpj || null,
          tipo_pessoa: form.tipo_pessoa,
          inscricao_estadual: form.inscricao_estadual || null,
          email: form.email || null,
          telefone: form.telefone || null,
          celular: form.celular || null,
          contato: form.contato || null,
          cep: form.cep || null,
          logradouro: form.logradouro || null,
          numero: form.numero || null,
          complemento: form.complemento || null,
          bairro: form.bairro || null,
          cidade: form.cidade || null,
          uf: form.uf || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Cliente cadastrado!");
      onCreated(data.id);
      reset();
      onClose();
    });
  };

  return (
    <FormModal
      open={open}
      onClose={handleClose}
      title="Cadastro Rápido de Cliente"
      mode="create"
      size="lg"
      isDirty={isDirty}
      confirmOnDirty
      createHint="Preencha os dados essenciais do cliente para reaproveitar no orçamento."
      footer={
        <FormModalFooter
          saving={saving}
          isDirty={isDirty}
          onCancel={handleClose}
          submitAsForm
          formId="quick-add-client-form"
          mode="create"
          primaryLabel="Cadastrar"
        />
      }
    >
      <form id="quick-add-client-form" onSubmit={handleSubmit} className="space-y-5">
        <FormSection icon={Building2} title="Identificação" noBorder>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo_pessoa} onValueChange={(v) => update("tipo_pessoa", v as TipoPessoa)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="J">Jurídica</SelectItem>
                  <SelectItem value="F">Física</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{form.tipo_pessoa === "J" ? "CNPJ" : "CPF"}</Label>
              <div className="flex gap-1">
                <MaskedInput mask="cpf_cnpj" value={form.cpf_cnpj} onChange={(v) => update("cpf_cnpj", v)} />
                {form.tipo_pessoa === "J" && (
                  <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={cnpjLoading} onClick={handleCnpjLookup} aria-label="Buscar CNPJ">
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
              placeholder="Nome completo ou razão social"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nome Fantasia</Label>
              <Input value={form.nome_fantasia} onChange={(e) => update("nome_fantasia", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Inscrição Estadual</Label>
              <Input value={form.inscricao_estadual} onChange={(e) => update("inscricao_estadual", e.target.value)} />
            </div>
          </div>
        </FormSection>

        <FormSection icon={Phone} title="Contato">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => update("telefone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Celular</Label>
              <Input value={form.celular} onChange={(e) => update("celular", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contato</Label>
              <Input value={form.contato} onChange={(e) => update("contato", e.target.value)} placeholder="Nome do contato" />
            </div>
          </div>
        </FormSection>

        <FormSection icon={MapPin} title="Endereço">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1 space-y-2">
              <Label>CEP</Label>
              <div className="flex gap-1">
                <MaskedInput mask="cep" value={form.cep} onChange={(v) => update("cep", v)} />
                <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={cepLoading} onClick={handleCepLookup} aria-label="Buscar CEP">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Logradouro</Label>
              <Input value={form.logradouro} onChange={(e) => update("logradouro", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={form.numero} onChange={(e) => update("numero", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input value={form.complemento} onChange={(e) => update("complemento", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input value={form.bairro} onChange={(e) => update("bairro", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cidade / UF</Label>
              <div className="flex gap-1">
                <Input value={form.cidade} onChange={(e) => update("cidade", e.target.value)} className="flex-1" />
                <Input
                  value={form.uf}
                  onChange={(e) => update("uf", e.target.value.toUpperCase())}
                  maxLength={2}
                  className="w-14 uppercase"
                />
              </div>
            </div>
          </div>
        </FormSection>
      </form>
    </FormModal>
  );
}
