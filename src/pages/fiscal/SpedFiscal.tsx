import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export interface SpedConfig {
  periodoInicio: string;
  periodoFim: string;
  tipo: "ecd" | "ecf" | "efd";
  perfil: "A" | "B" | "C";
}

const spedSchema = z.object({
  periodoInicio: z.string().min(1, "Período início obrigatório"),
  periodoFim: z.string().min(1, "Período fim obrigatório"),
  tipo: z.enum(["ecd", "ecf", "efd"]),
  perfil: z.enum(["A", "B", "C"]),
});

type SpedFormData = z.infer<typeof spedSchema>;

export default function SpedFiscal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [gerando, setGerando] = useState(false);

  const form = useForm<SpedFormData>({
    resolver: zodResolver(spedSchema),
    defaultValues: {
      periodoInicio: searchParams.get("data_inicio") ?? "",
      periodoFim: searchParams.get("data_fim") ?? "",
      tipo: (searchParams.get("tipo") as SpedFormData["tipo"]) ?? "efd",
      perfil: (searchParams.get("perfil") as SpedFormData["perfil"]) ?? "A",
    },
  });

  function handleGerar(data: SpedFormData) {
    setSearchParams({
      data_inicio: data.periodoInicio,
      data_fim: data.periodoFim,
      tipo: data.tipo,
      perfil: data.perfil,
    }, { replace: true });
    setGerando(true);
    // Simulação: em produção, chamar o serviço de geração do SPED
    setTimeout(() => {
      setGerando(false);
      toast.success(
        `SPED ${data.tipo.toUpperCase()} gerado para o período ${data.periodoInicio} a ${data.periodoFim}`,
      );
    }, 1500);
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">SPED Fiscal</h1>

      <div className="max-w-lg rounded-md border p-6">
        <h2 className="mb-4 text-base font-semibold">Configurar Geração</h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleGerar)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="periodoInicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Período Início</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="periodoFim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Período Fim</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de SPED</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="efd">EFD – Escrituração Fiscal Digital</SelectItem>
                      <SelectItem value="ecd">ECD – Escrituração Contábil Digital</SelectItem>
                      <SelectItem value="ecf">ECF – Escrituração Contábil Fiscal</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="perfil"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Perfil</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="A">Perfil A</SelectItem>
                      <SelectItem value="B">Perfil B</SelectItem>
                      <SelectItem value="C">Perfil C</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={gerando} className="w-full">
              <FileDown className="mr-2 h-4 w-4" />
              {gerando ? "Gerando..." : "Gerar SPED"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
