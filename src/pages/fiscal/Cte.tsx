import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CertificadoValidadeAlert } from "@/components/fiscal/CertificadoValidadeAlert";
import type { Database } from "@/integrations/supabase/types";

type NotaFiscalRow = Database["public"]["Tables"]["notas_fiscais"]["Row"];

export interface CteFormData {
  numero?: string;
  serie: string;
  dataEmissao: string;
  cfop: string;
  naturezaOperacao: string;
  remetente: string;
  destinatario: string;
  valorCarga: number;
  valorFrete: number;
  observacoes?: string;
}

async function fetchCtes(search?: string): Promise<NotaFiscalRow[]> {
  let query = supabase
    .from("notas_fiscais")
    .select("*")
    .eq("ativo", true)
    .eq("modelo_documento", "57")
    .order("created_at", { ascending: false });

  if (search) query = query.ilike("numero", `%${search}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export default function Cte() {
  const [search, setSearch] = useState("");

  const { data: ctes, isLoading } = useQuery({
    queryKey: ["cte", search],
    queryFn: () => fetchCtes(search),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-4 p-6">
      <CertificadoValidadeAlert />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Conhecimento de Transporte Eletrônico (CT-e)</h1>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          Novo CT-e
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por número..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Série</TableHead>
              <TableHead>Data Emissão</TableHead>
              <TableHead>Valor Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : (ctes ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhum CT-e encontrado.
                </TableCell>
              </TableRow>
            ) : (
              (ctes ?? []).map((cte) => (
                <TableRow key={cte.id}>
                  <TableCell>{cte.numero ?? "—"}</TableCell>
                  <TableCell>{cte.serie ?? "—"}</TableCell>
                  <TableCell>
                    {cte.data_emissao
                      ? new Date(cte.data_emissao).toLocaleDateString("pt-BR")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {cte.valor_total?.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }) ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={cte.status === "autorizada" ? "default" : "secondary"}>
                      {cte.status ?? "—"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
