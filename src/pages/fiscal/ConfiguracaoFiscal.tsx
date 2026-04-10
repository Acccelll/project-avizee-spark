import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Save } from "lucide-react";
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

export interface ConfiguracaoFiscalData {
  regimeTributario: "1" | "2" | "3";
  inscricaoEstadual: string;
  cnae: string;
  sefazAmbiente: "1" | "2";
  sefazUrlNFe: string;
  sefazUrlNFCe: string;
  certificadoTipo: "A1" | "A3";
  certificadoSenha?: string;
}

const configuracaoSchema = z.object({
  regimeTributario: z.enum(["1", "2", "3"]),
  inscricaoEstadual: z.string().min(1, "Inscrição Estadual obrigatória"),
  cnae: z.string().min(4, "CNAE inválido"),
  sefazAmbiente: z.enum(["1", "2"]),
  sefazUrlNFe: z.string().url("URL inválida").or(z.literal("")),
  sefazUrlNFCe: z.string().url("URL inválida").or(z.literal("")),
  certificadoTipo: z.enum(["A1", "A3"]),
  certificadoSenha: z.string().optional(),
});

export default function ConfiguracaoFiscal() {
  const form = useForm<ConfiguracaoFiscalData>({
    resolver: zodResolver(configuracaoSchema),
    defaultValues: {
      regimeTributario: "1",
      sefazAmbiente: "2",
      certificadoTipo: "A1",
      sefazUrlNFe: "",
      sefazUrlNFCe: "",
      inscricaoEstadual: "",
      cnae: "",
    },
  });

  function handleSalvar(data: ConfiguracaoFiscalData) {
    // Em produção: salvar no Supabase em app_configuracoes
    console.log("Configurações fiscais:", data);
    toast.success("Configurações fiscais salvas");
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Configuração Fiscal</h1>

      <div className="max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSalvar)} className="space-y-6">
            <div>
              <h2 className="text-base font-semibold">Regime Tributário</h2>
              <Separator className="my-2" />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="regimeTributario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Regime</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1 – Simples Nacional</SelectItem>
                          <SelectItem value="2">2 – Lucro Presumido</SelectItem>
                          <SelectItem value="3">3 – Lucro Real</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="inscricaoEstadual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inscrição Estadual</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: 111.111.111.119 ou ISENTO" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cnae"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNAE Principal</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: 4711-3/01" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold">Integração SEFAZ</h2>
              <Separator className="my-2" />
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="sefazAmbiente"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ambiente</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="max-w-xs">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="2">2 – Homologação (testes)</SelectItem>
                          <SelectItem value="1">1 – Produção</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Use Homologação para testes; Produção somente com certificado válido.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sefazUrlNFe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL WebService NF-e</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sefazUrlNFCe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL WebService NFC-e</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://..." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div>
              <h2 className="text-base font-semibold">Certificado Digital</h2>
              <Separator className="my-2" />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="certificadoTipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Certificado</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="A1">A1 – Arquivo .pfx</SelectItem>
                          <SelectItem value="A3">A3 – Token/Smartcard</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="certificadoSenha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha do Certificado</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Senha do arquivo .pfx" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit">
                <Save className="mr-2 h-4 w-4" />
                Salvar Configurações
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
