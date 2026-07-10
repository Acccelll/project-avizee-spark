/**
 * Gestão de Regras e Aliases do motor de matching (Épico G — Financeiro
 * Inteligente 2.0). CRUD simples para admin/financeiro.
 *
 * As regras casam descrição bancária → fornecedor / centro de custo /
 * conta contábil por substring ou regex. Aliases são atalhos por
 * descrição normalizada (aprendidos ou manuais).
 */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { logger } from "@/lib/logger";

interface Regra {
  id: string;
  nome: string;
  padrao: string;
  padrao_tipo: string;
  quando_tipo: string;
  prioridade: number;
  ativo: boolean;
  aplica_fornecedor_id: string | null;
  aplica_centro_custo_id: string | null;
  aplica_conta_contabil_id: string | null;
}

interface Alias {
  id: string;
  descricao_normalizada: string;
  hits: number;
  ultima_confirmacao_em: string;
  fornecedor_id: string | null;
}

export default function FinanceiroRegrasAliases() {
  const [tab, setTab] = useState("regras");
  const [regras, setRegras] = useState<Regra[]>([]);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [fornecedores, setFornecedores] = useState<{ id: string; nome: string }[]>([]);
  const [centros, setCentros] = useState<{ id: string; nome: string }[]>([]);
  const [contasCont, setContasCont] = useState<{ id: string; nome: string }[]>([]);
  const [novaRegra, setNovaRegra] = useState({
    nome: "",
    padrao: "",
    padrao_tipo: "substring",
    quando_tipo: "ambos",
    prioridade: 100,
    aplica_fornecedor_id: "",
    aplica_centro_custo_id: "",
    aplica_conta_contabil_id: "",
  });

  const carregar = async () => {
    const [rRes, aRes, fRes, cRes, ccRes] = await Promise.all([
      supabase
        .from("financeiro_regras")
        .select("*")
        .order("prioridade", { ascending: false }),
      supabase
        .from("financeiro_aliases")
        .select("*")
        .order("hits", { ascending: false })
        .limit(200),
      supabase.from("fornecedores").select("id, nome").order("nome").limit(1000),
      supabase.from("centros_custo").select("id, nome").order("nome").limit(500),
      supabase.from("contas_contabeis").select("id, nome").order("nome").limit(1000),
    ]);
    if (rRes.error) logger.error("[regras]", rRes.error);
    if (aRes.error) logger.error("[aliases]", aRes.error);
    setRegras((rRes.data as Regra[]) ?? []);
    setAliases((aRes.data as Alias[]) ?? []);
    setFornecedores((fRes.data as { id: string; nome: string }[]) ?? []);
    setCentros((cRes.data as { id: string; nome: string }[]) ?? []);
    setContasCont((ccRes.data as { id: string; nome: string }[]) ?? []);
  };

  useEffect(() => {
    carregar();
  }, []);

  const criarRegra = async () => {
    if (!novaRegra.nome.trim() || !novaRegra.padrao.trim()) {
      toast.error("Informe nome e padrão.");
      return;
    }
    const alvoDefinido =
      novaRegra.aplica_fornecedor_id ||
      novaRegra.aplica_centro_custo_id ||
      novaRegra.aplica_conta_contabil_id;
    if (!alvoDefinido) {
      toast.error("Escolha ao menos um alvo (fornecedor, centro de custo ou conta contábil).");
      return;
    }
    if (novaRegra.padrao_tipo === "regex") {
      try {
        new RegExp(novaRegra.padrao);
      } catch {
        toast.error("Regex inválida.");
        return;
      }
    }
    const { error } = await supabase.from("financeiro_regras").insert({
      nome: novaRegra.nome.trim(),
      padrao: novaRegra.padrao.trim(),
      padrao_tipo: novaRegra.padrao_tipo,
      quando_tipo: novaRegra.quando_tipo,
      prioridade: Number(novaRegra.prioridade) || 100,
      ativo: true,
      aplica_fornecedor_id: novaRegra.aplica_fornecedor_id || null,
      aplica_centro_custo_id: novaRegra.aplica_centro_custo_id || null,
      aplica_conta_contabil_id: novaRegra.aplica_conta_contabil_id || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Regra criada.");
    setNovaRegra({
      nome: "", padrao: "", padrao_tipo: "substring", quando_tipo: "ambos", prioridade: 100,
      aplica_fornecedor_id: "", aplica_centro_custo_id: "", aplica_conta_contabil_id: "",
    });
    carregar();
  };

  const toggleRegra = async (id: string, ativo: boolean) => {
    const { error } = await supabase.from("financeiro_regras").update({ ativo }).eq("id", id);
    if (error) return toast.error(error.message);
    carregar();
  };

  const removerRegra = async (id: string) => {
    if (!confirm("Remover esta regra?")) return;
    const { error } = await supabase.from("financeiro_regras").delete().eq("id", id);
    if (error) return toast.error(error.message);
    carregar();
  };

  const removerAlias = async (id: string) => {
    if (!confirm("Remover este alias? A próxima importação não terá o hint.")) return;
    const { error } = await supabase.from("financeiro_aliases").delete().eq("id", id);
    if (error) return toast.error(error.message);
    carregar();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Regras &amp; Aliases</h1>
        <p className="text-sm text-muted-foreground">
          Motor declarativo que enriquece a conciliação e a importação de extratos com sugestões automáticas.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="regras">Regras ({regras.length})</TabsTrigger>
          <TabsTrigger value="aliases">Aliases ({aliases.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="regras" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Nova regra</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input value={novaRegra.nome} onChange={(e) => setNovaRegra({ ...novaRegra, nome: e.target.value })} placeholder="Ex.: Energia CEMIG" />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs">Padrão</Label>
                <Input value={novaRegra.padrao} onChange={(e) => setNovaRegra({ ...novaRegra, padrao: e.target.value })} placeholder="Ex.: cemig / boleto cemig" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={novaRegra.padrao_tipo} onValueChange={(v) => setNovaRegra({ ...novaRegra, padrao_tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="substring">substring</SelectItem>
                    <SelectItem value="regex">regex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quando</Label>
                <Select value={novaRegra.quando_tipo} onValueChange={(v) => setNovaRegra({ ...novaRegra, quando_tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ambos">ambos</SelectItem>
                    <SelectItem value="debito">débito</SelectItem>
                    <SelectItem value="credito">crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-6 flex justify-end">
                <Button onClick={criarRegra}><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Padrão</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead className="text-right">Prioridade</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {regras.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="font-mono text-xs">{r.padrao}</TableCell>
                    <TableCell>{r.padrao_tipo}</TableCell>
                    <TableCell>{r.quando_tipo}</TableCell>
                    <TableCell className="text-right">{r.prioridade}</TableCell>
                    <TableCell>
                      <Switch checked={r.ativo} onCheckedChange={(v) => toggleRegra(r.id, v)} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removerRegra(r.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {regras.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma regra cadastrada.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="aliases">
          <p className="text-xs text-muted-foreground mb-2">
            Aliases são aprendidos automaticamente a cada conciliação confirmada. Você pode remover para reiniciar o aprendizado.
          </p>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição normalizada</TableHead>
                  <TableHead className="text-right">Hits</TableHead>
                  <TableHead>Última confirmação</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {aliases.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.descricao_normalizada}</TableCell>
                    <TableCell className="text-right">{a.hits}</TableCell>
                    <TableCell>{new Date(a.ultima_confirmacao_em).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removerAlias(a.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {aliases.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum alias aprendido ainda.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}