import { useEffect, useRef, useState } from "react";
import { Building2, Phone } from "lucide-react";
import { FormModal } from "@/components/FormModal";
import { FormModalFooter } from "@/components/FormModalFooter";
import { FormSection } from "@/components/FormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { useCnpjLookup } from "@/hooks/useCnpjLookup";
import { useSubmitLock } from "@/hooks/useSubmitLock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search } from "lucide-react";

interface QuickAddClientModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Chamado com o cliente a usar. `info.reused = true` quando o CNPJ/CPF já
   * pertencia a um cliente ativo: nada foi gravado e o cadastro existente é
   * devolvido (os dados digitados no modal são descartados).
   */
  onCreated: (clienteId: string, info: QuickAddClientResult) => void;
  /** Pré-preenchimento opcional (ex.: cliente extraído do XML da NF-e). */
  defaults?: Partial<{
    nome_razao_social: string;
    nome_fantasia: string;
    cpf_cnpj: string;
    tipo_pessoa: "F" | "J";
    inscricao_estadual: string;
    email: string;
    telefone: string;
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
  }>;
}

type TipoPessoa = "F" | "J";

export interface QuickAddClientResult {
  reused: boolean;
  nome: string;
}

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

export function QuickAddClientModal({ open, onClose, onCreated, defaults }: QuickAddClientModalProps) {
  const { saving, submit } = useSubmitLock({ errorPrefix: "Erro ao cadastrar cliente" });
  const { buscarCnpj, loading: cnpjLoading } = useCnpjLookup();
  const [form, setForm] = useState({ ...emptyForm });
  const [isDirty, setIsDirty] = useState(false);
  // Aviso de documento duplicado ativo (toast com ação "Usar este cliente").
  // É descartado sempre que deixa de valer: documento alterado, nova tentativa,
  // modal fechado/resetado ou desmontado — para a ação não selecionar um
  // cliente de uma tentativa antiga.
  const avisoDuplicadoRef = useRef<string | number | null>(null);

  const descartarAvisoDuplicado = () => {
    if (avisoDuplicadoRef.current !== null) {
      toast.dismiss(avisoDuplicadoRef.current);
      avisoDuplicadoRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) descartarAvisoDuplicado();
  }, [open]);

  useEffect(() => () => descartarAvisoDuplicado(), []);

  useEffect(() => {
    if (open && defaults) {
      setForm((prev) => ({ ...prev, ...defaults }));
      setIsDirty(true);
    }
  }, [open, defaults]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    if (key === "cpf_cnpj" || key === "tipo_pessoa") descartarAvisoDuplicado();
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleCnpjLookup = async () => {
    const result = await buscarCnpj(form.cpf_cnpj);
    if (result) {
      descartarAvisoDuplicado();
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

  const reset = () => {
    descartarAvisoDuplicado();
    setForm({ ...emptyForm });
    setIsDirty(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  /**
   * CNPJ/CPF já cadastrado (índice único `ux_clientes_cpf_cnpj_ativo`): em vez
   * de tentar inserir e receber 409, avisa quem é o titular do documento e só
   * usa o cadastro existente se o usuário confirmar (o documento pode ter sido
   * digitado errado aqui ou no cadastro antigo).
   */
  const buscarClienteAtivoPorDocumento = async (doc: string) => {
    const { data, error } = await supabase
      .from("clientes")
      .select("id, nome_razao_social")
      .eq("cpf_cnpj", doc)
      .eq("ativo", true)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const usarClienteExistente = (existente: { id: string; nome_razao_social: string }) => {
    onCreated(existente.id, { reused: true, nome: existente.nome_razao_social });
    reset();
    onClose();
  };

  const avisarDocumentoDuplicado = (existente: { id: string; nome_razao_social: string }) => {
    descartarAvisoDuplicado();
    const rotulo = form.tipo_pessoa === "F" ? "CPF" : "CNPJ";
    const id = toast.error(`${rotulo} já cadastrado para ${existente.nome_razao_social}`, {
      description: `Confira o ${rotulo} digitado ou use o cadastro existente.`,
      duration: 10000,
      action: {
        label: "Usar este cliente",
        onClick: () => {
          // Só vale enquanto este for o aviso vigente da tentativa atual.
          if (avisoDuplicadoRef.current !== id) return;
          avisoDuplicadoRef.current = null;
          usarClienteExistente(existente);
        },
      },
    });
    avisoDuplicadoRef.current = id;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_razao_social.trim()) {
      toast.error("Nome / Razão Social é obrigatório");
      return;
    }
    // O banco normaliza o documento para dígitos (trg_normaliza_documento).
    const documento = form.cpf_cnpj.replace(/\D/g, "");
    descartarAvisoDuplicado();
    try {
      await submit(async () => {
        if (documento) {
          const existente = await buscarClienteAtivoPorDocumento(documento);
          if (existente) {
            avisarDocumentoDuplicado(existente);
            return;
          }
        }
        const { data, error } = await supabase
          .from("clientes")
          .insert({
            nome_razao_social: form.nome_razao_social,
            nome_fantasia: form.nome_fantasia || null,
            cpf_cnpj: documento || null,
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
        if (error) {
          // Corrida: outro usuário cadastrou o mesmo documento entre a checagem e o insert.
          if (error.code === "23505" && documento) {
            const existente = await buscarClienteAtivoPorDocumento(documento);
            if (existente) {
              avisarDocumentoDuplicado(existente);
              return;
            }
          }
          throw error;
        }
        toast.success("Cliente cadastrado!");
        onCreated(data.id, { reused: false, nome: form.nome_razao_social });
        reset();
        onClose();
      });
    } catch {
      // Erro já exibido em toast pelo useSubmitLock; o modal permanece aberto para correção.
    }
  };

  return (
    <FormModal
      open={open}
      onClose={handleClose}
      title="Cadastro Rápido de Cliente"
      mode="create"
      size="md"
      isDirty={isDirty}
      confirmOnDirty
      createHint="Apenas o essencial — endereço, e-mail e condições comerciais podem ser adicionados após o cadastro."
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
              placeholder={form.tipo_pessoa === "J" ? "Razão social" : "Nome completo"}
              required
            />
          </div>
        </FormSection>

        <FormSection icon={Phone} title="Contato">
          <div className="space-y-2">
            <Label>WhatsApp / Telefone</Label>
            <MaskedInput mask="telefone" value={form.celular} onChange={(v) => update("celular", v)} />
          </div>
        </FormSection>

        <p className="text-xs text-muted-foreground">
          Endereço, e-mail e condições comerciais podem ser adicionados após o cadastro.
        </p>
      </form>
    </FormModal>
  );
}
