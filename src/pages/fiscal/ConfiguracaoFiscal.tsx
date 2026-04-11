import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const configuracaoSchema = z.object({
  crt: z.string().min(1, "CRT obrigatório"),
  cnae: z.string().optional(),
  regime_tributario: z.string().optional(),
  inscricao_estadual: z.string().optional(),
  codigo_ibge_municipio: z.string().optional(),
  email_fiscal: z.string().email("E-mail inválido").or(z.literal("")).optional(),
  serie_padrao_nfe: z.string().min(1, "Série obrigatória"),
  proximo_numero_nfe: z.coerce.number().min(1, "Número inválido"),
  ambiente_padrao: z.enum(["homologacao", "producao"]),
  sefazUrlNFe: z.string().url("URL inválida").or(z.literal("")).optional(),
  certificadoTipo: z.enum(["A1", "A3"]),
  certificadoSenha: z.string().optional(),
});

type FormData = z.infer<typeof configuracaoSchema>;

export default function ConfiguracaoFiscal() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(configuracaoSchema),
    defaultValues: {
      crt: "1",
      cnae: "",
      regime_tributario: "simples_nacional",
      inscricao_estadual: "",
      codigo_ibge_municipio: "",
      email_fiscal: "",
      serie_padrao_nfe: "1",
      proximo_numero_nfe: 1,
      ambiente_padrao: "homologacao",
      sefazUrlNFe: "",
      certificadoTipo: "A1",
      certificadoSenha: "",
    },
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("empresa_config").select("*").limit(1).single();
      if (data) {
        setConfigId(data.id);
        form.reset({
          crt: data.crt || "1",
          cnae: data.cnae || "",
          regime_tributario: data.regime_tributario || "simples_nacional",
          inscricao_estadual: data.inscricao_estadual || "",
          codigo_ibge_municipio: data.codigo_ibge_municipio || "",
          email_fiscal: data.email_fiscal || "",
          serie_padrao_nfe: data.serie_padrao_nfe || "1",
          proximo_numero_nfe: data.proximo_numero_nfe || 1,
          ambiente_padrao: (data.ambiente_padrao as "homologacao" | "producao") || "homologacao",
          sefazUrlNFe: "",
          certificadoTipo: "A1",
          certificadoSenha: "",
        });
      }
      setLoading(false);
    })();
  }, []);

  async function handleSalvar(values: FormData) {
    setSaving(true);
    try {
      const payload = {
        crt: values.crt,
        cnae: values.cnae || null,
        regime_tributario: values.regime_tributario || null,
        codigo_ibge_municipio: values.codigo_ibge_municipio || null,
        email_fiscal: values.email_fiscal || null,
        serie_padrao_nfe: values.serie_padrao_nfe,
        proximo_numero_nfe: values.proximo_numero_nfe,
        ambiente_padrao: values.ambiente_padrao,
      };

      if (configId) {
        await supabase.from("empresa_config").update(payload).eq("id", configId);
      } else {
        const { data } = await supabase.from("empresa_config").insert(payload as any).select().single();
        if (data) setConfigId(data.id);
      }
      toast.success("Configurações fiscais salvas");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar configurações");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Configuração Fiscal</h1>

      <div className="max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSalvar)} className="space-y-6">
            {/* Regime Tributário */}
            <div>
              <h2 className="text-base font-semibold">Regime Tributário</h2>
              <Separator className="my-2" />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="crt" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CRT</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="1">1 – Simples Nacional</SelectItem>
                        <SelectItem value="2">2 – Simples Nacional (excesso)</SelectItem>
                        <SelectItem value="3">3 – Regime Normal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="regime_tributario" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regime</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                        <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                        <SelectItem value="lucro_real">Lucro Real</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="cnae" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CNAE Principal</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: 4711-3/01" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="codigo_ibge_municipio" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código IBGE Município</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: 3550308" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email_fiscal" render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail Fiscal</FormLabel>
                    <FormControl><Input {...field} type="email" placeholder="fiscal@empresa.com" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Numeração NF-e */}
            <div>
              <h2 className="text-base font-semibold">Numeração NF-e</h2>
              <Separator className="my-2" />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="serie_padrao_nfe" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Série Padrão</FormLabel>
                    <FormControl><Input {...field} placeholder="1" className="font-mono" /></FormControl>
                    <FormDescription>Série usada na emissão de NF-e</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="proximo_numero_nfe" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Próximo Número NF-e</FormLabel>
                    <FormControl><Input {...field} type="number" min={1} className="font-mono" /></FormControl>
                    <FormDescription>Número sequencial da próxima nota</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Integração SEFAZ */}
            <div>
              <h2 className="text-base font-semibold">Integração SEFAZ</h2>
              <Separator className="my-2" />
              <div className="space-y-4">
                <FormField control={form.control} name="ambiente_padrao" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ambiente Padrão</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="homologacao">Homologação (testes)</SelectItem>
                        <SelectItem value="producao">Produção</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>Use Homologação para testes; Produção somente com certificado válido.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Certificado Digital */}
            <div>
              <h2 className="text-base font-semibold">Certificado Digital</h2>
              <Separator className="my-2" />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="certificadoTipo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Certificado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="A1">A1 – Arquivo .pfx</SelectItem>
                        <SelectItem value="A3">A3 – Token/Smartcard</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="certificadoSenha" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha do Certificado</FormLabel>
                    <FormControl><Input {...field} type="password" placeholder="Senha do arquivo .pfx" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {saving ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
