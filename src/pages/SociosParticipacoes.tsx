import { useMemo, useState } from "react";
import { ModulePage } from "@/components/ModulePage";
import { SummaryCard } from "@/components/SummaryCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormModal } from "@/components/FormModal";
import { FormModalFooter } from "@/components/FormModalFooter";
import { StatusBadge } from "@/components/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, PieChart, TrendingUp, RotateCcw, Lock, Unlock, Plus, FileCheck, Ban, FileText } from "lucide-react";
import { useApuracoesSocietarias, useSocios, useSociosRetiradas, useSocioParametros } from "@/hooks/useSocios";
import { useSubmitLock } from "@/hooks/useSubmitLock";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import type { SocioRetirada } from "@/types/domain";

const currentMonth = () => new Date().toISOString().slice(0, 7);

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho", aprovado: "Aprovado", financeiro_gerado: "Financeiro gerado",
  pago: "Pago", cancelado: "Cancelado", fechado: "Fechado",
};

const TIPO_LABEL: Record<string, string> = {
  pro_labore: "Pró-labore", bonus: "Bônus", distribuicao_lucros: "Distribuição", ajuste: "Ajuste",
};

export default function SociosParticipacoes() {
  const [competencia, setCompetencia] = useState(currentMonth());
  const { socios } = useSocios();
  const { apuracoes, itens, criar, recalcular, fechar, reabrir, updateBasic, loadingItens } = useApuracoesSocietarias(competencia);
  const { retiradas, create: createRetirada, aprovar, gerarFinanceiro, cancelar } = useSociosRetiradas({ competencia });
  const { parametros, upsert: upsertParam } = useSocioParametros();
  const { saving, submit } = useSubmitLock();

  const apuracaoAtual = useMemo(() => apuracoes.find((a) => a.competencia === competencia), [apuracoes, competencia]);

  const kpis = useMemo(() => {
    const totalRetirado = itens.reduce((s, i) => s + Number(i.retirado_no_periodo ?? 0), 0);
    const totalDireito = itens.reduce((s, i) => s + Number(i.direito_teorico ?? 0), 0);
    return {
      lucroBase: Number(apuracaoAtual?.lucro_base ?? 0),
      proLabore: Number(apuracaoAtual?.pro_labore_total ?? 0),
      bonus: Number(apuracaoAtual?.bonus_total ?? 0),
      retirado: totalRetirado,
      direito: totalDireito,
      saldo: totalDireito + Number(apuracaoAtual?.pro_labore_total ?? 0) + Number(apuracaoAtual?.bonus_total ?? 0) - totalRetirado,
    };
  }, [apuracaoAtual, itens]);

  // Modais
  const [retiradaOpen, setRetiradaOpen] = useState(false);
  const [retiradaForm, setRetiradaForm] = useState({
    socio_id: "", tipo: "bonus" as const, valor_calculado: 0, data_prevista: new Date().toISOString().split("T")[0], observacoes: "",
  });
  const [gerarFinOpen, setGerarFinOpen] = useState<SocioRetirada | null>(null);
  const [gerarForm, setGerarForm] = useState({ data_vencimento: new Date().toISOString().split("T")[0] });
  const [reabrirOpen, setReabrirOpen] = useState(false);
  const [reabrirMotivo, setReabrirMotivo] = useState("");

  // Edição inline da apuração
  const [editAjustes, setEditAjustes] = useState<string>("");
  const ajustesEffective = editAjustes !== "" ? Number(editAjustes) : Number(apuracaoAtual?.ajustes ?? 0);

  const handleCriarApuracao = async () => {
    await submit(async () => { await criar.mutateAsync({ competencia }); });
  };

  const handleSalvarAjustes = async () => {
    if (!apuracaoAtual) return;
    await submit(async () => {
      await updateBasic.mutateAsync({ id: apuracaoAtual.id, ajustes: ajustesEffective });
      await recalcular.mutateAsync(apuracaoAtual.id);
      setEditAjustes("");
    });
  };

  const handleNovaRetirada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retiradaForm.socio_id) { toast.error("Selecione um sócio"); return; }
    if (retiradaForm.valor_calculado <= 0) { toast.error("Informe o valor"); return; }
    await submit(async () => {
      await createRetirada.mutateAsync({
        socio_id: retiradaForm.socio_id,
        competencia,
        apuracao_id: apuracaoAtual?.id ?? null,
        tipo: retiradaForm.tipo,
        criterio_rateio: "manual",
        valor_calculado: retiradaForm.valor_calculado,
        data_prevista: retiradaForm.data_prevista,
        observacoes: retiradaForm.observacoes || null,
      });
      setRetiradaOpen(false);
      setRetiradaForm({ ...retiradaForm, valor_calculado: 0, observacoes: "" });
    });
  };

  const handleGerarFinanceiro = async () => {
    if (!gerarFinOpen) return;
    await submit(async () => {
      await gerarFinanceiro.mutateAsync({ id: gerarFinOpen.id, data_vencimento: gerarForm.data_vencimento });
      setGerarFinOpen(null);
    });
  };

  // Parâmetros (pró-labore)
  const [paramForm, setParamForm] = useState({ competencia: currentMonth(), pro_labore_total: 0, observacoes: "" });

  const handleSalvarParametro = async () => {
    if (paramForm.pro_labore_total < 0) { toast.error("Valor inválido"); return; }
    await submit(async () => {
      await upsertParam.mutateAsync({
        competencia: paramForm.competencia,
        pro_labore_total: paramForm.pro_labore_total,
        base_referencia: "manual",
        observacoes: paramForm.observacoes || null,
      });
    });
  };

  return (
    <>
      <ModulePage
        title="Sócios e Participações"
        subtitle="Apuração mensal, retiradas e geração financeira"
        summaryCards={
          <>
            <SummaryCard title="Lucro base" value={formatCurrency(kpis.lucroBase)} icon={TrendingUp} />
            <SummaryCard title="Pró-labore mês" value={formatCurrency(kpis.proLabore)} icon={DollarSign} />
            <SummaryCard title="Bônus mês" value={formatCurrency(kpis.bonus)} icon={PieChart} />
            <SummaryCard title="Saldo a distribuir" value={formatCurrency(kpis.saldo)} icon={DollarSign} variant={kpis.saldo < 0 ? "danger" : "success"} />
          </>
        }
      >
        <Tabs defaultValue="apuracao">
          <TabsList>
            <TabsTrigger value="apuracao">Apuração mensal</TabsTrigger>
            <TabsTrigger value="retiradas">Retiradas</TabsTrigger>
            <TabsTrigger value="parametros">Parâmetros</TabsTrigger>
          </TabsList>

          {/* APURAÇÃO */}
          <TabsContent value="apuracao" className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
              <div className="space-y-1.5">
                <Label>Competência</Label>
                <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="w-[180px]" />
              </div>
              {apuracaoAtual ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <StatusBadge status={apuracaoAtual.status} />
                  </div>
                  <div className="ml-auto flex gap-2">
                    {apuracaoAtual.status === "rascunho" && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => recalcular.mutate(apuracaoAtual.id)}>
                          <RotateCcw className="h-4 w-4 mr-1" /> Recalcular
                        </Button>
                        <Button size="sm" onClick={() => fechar.mutate(apuracaoAtual.id)}>
                          <Lock className="h-4 w-4 mr-1" /> Fechar
                        </Button>
                      </>
                    )}
                    {(apuracaoAtual.status === "fechado" || apuracaoAtual.status === "aprovado") && (
                      <Button variant="outline" size="sm" onClick={() => setReabrirOpen(true)}>
                        <Unlock className="h-4 w-4 mr-1" /> Reabrir
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <Button size="sm" onClick={handleCriarApuracao} disabled={saving}>
                  <Plus className="h-4 w-4 mr-1" /> Criar apuração
                </Button>
              )}
            </div>

            {apuracaoAtual && apuracaoAtual.status === "rascunho" && (
              <div className="flex items-end gap-3 rounded-lg border p-4">
                <div className="space-y-1.5 flex-1 max-w-xs">
                  <Label>Ajustes (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editAjustes !== "" ? editAjustes : Number(apuracaoAtual.ajustes ?? 0)}
                    onChange={(e) => setEditAjustes(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleSalvarAjustes}>Aplicar e recalcular</Button>
                <p className="text-xs text-muted-foreground ml-2">
                  Lucro distribuível = lucro base ({formatCurrency(Number(apuracaoAtual.lucro_base))}) + ajustes
                </p>
              </div>
            )}

            {apuracaoAtual && (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sócio</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-right">Direito teórico</TableHead>
                      <TableHead className="text-right">Pró-labore</TableHead>
                      <TableHead className="text-right">Bônus</TableHead>
                      <TableHead className="text-right">Retirado</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingItens && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Carregando...</TableCell></TableRow>}
                    {!loadingItens && itens.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sem itens</TableCell></TableRow>
                    )}
                    {itens.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium">{it.socios?.nome ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono">{Number(it.percentual_aplicado).toFixed(2)}%</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(Number(it.direito_teorico))}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(Number(it.pro_labore_calculado))}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(Number(it.bonus_calculado))}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(Number(it.retirado_no_periodo))}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{formatCurrency(Number(it.saldo_disponivel))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* RETIRADAS */}
          <TabsContent value="retiradas" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Eventos da competência {competencia}</p>
              <Button size="sm" onClick={() => setRetiradaOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Nova retirada
              </Button>
            </div>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sócio</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Prevista</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retiradas.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhuma retirada</TableCell></TableRow>
                  )}
                  {retiradas.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.socios?.nome ?? "—"}</TableCell>
                      <TableCell>{TIPO_LABEL[r.tipo] ?? r.tipo}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(Number(r.valor_aprovado ?? r.valor_calculado))}</TableCell>
                      <TableCell>{r.data_prevista ? formatDate(r.data_prevista) : "—"}</TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-right space-x-1">
                        {r.status === "rascunho" && (
                          <Button size="sm" variant="outline" onClick={() => aprovar.mutate(r.id)}>
                            <FileCheck className="h-3.5 w-3.5 mr-1" /> Aprovar
                          </Button>
                        )}
                        {r.status === "aprovado" && (
                          <Button size="sm" onClick={() => { setGerarFinOpen(r); setGerarForm({ data_vencimento: r.data_prevista ?? new Date().toISOString().split("T")[0] }); }}>
                            <FileText className="h-3.5 w-3.5 mr-1" /> Gerar financeiro
                          </Button>
                        )}
                        {r.status !== "cancelado" && r.status !== "pago" && (
                          <Button size="sm" variant="ghost" onClick={() => {
                            const motivo = window.prompt("Motivo do cancelamento:");
                            if (motivo) cancelar.mutate({ id: r.id, motivo });
                          }}>
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* PARÂMETROS */}
          <TabsContent value="parametros" className="space-y-4">
            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="font-medium text-sm">Definir pró-labore por competência</h4>
              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label>Competência</Label>
                  <Input type="month" value={paramForm.competencia} onChange={(e) => setParamForm({ ...paramForm, competencia: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Pró-labore total (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={paramForm.pro_labore_total} onChange={(e) => setParamForm({ ...paramForm, pro_labore_total: Number(e.target.value) })} />
                </div>
                <Button onClick={handleSalvarParametro} disabled={saving}>Salvar</Button>
              </div>
              <Textarea placeholder="Observações" value={paramForm.observacoes} onChange={(e) => setParamForm({ ...paramForm, observacoes: e.target.value })} rows={2} />
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Competência</TableHead>
                    <TableHead className="text-right">Pró-labore total</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parametros.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Nenhum parâmetro</TableCell></TableRow>
                  )}
                  {parametros.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.competencia}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(Number(p.pro_labore_total))}</TableCell>
                      <TableCell>{p.base_referencia}</TableCell>
                      <TableCell className="text-muted-foreground">{p.observacoes ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </ModulePage>

      {/* Modal: nova retirada */}
      <FormModal
        open={retiradaOpen}
        onClose={() => setRetiradaOpen(false)}
        title="Nova retirada"
        size="md"
        footer={<FormModalFooter saving={saving} onCancel={() => setRetiradaOpen(false)} submitAsForm formId="retirada-form" mode="create" />}
      >
        <form id="retirada-form" onSubmit={handleNovaRetirada} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Sócio *</Label>
            <Select value={retiradaForm.socio_id} onValueChange={(v) => setRetiradaForm({ ...retiradaForm, socio_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {socios.filter((s) => s.ativo).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={retiradaForm.tipo} onValueChange={(v) => setRetiradaForm({ ...retiradaForm, tipo: v as typeof retiradaForm.tipo })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pro_labore">Pró-labore</SelectItem>
                  <SelectItem value="bonus">Bônus</SelectItem>
                  <SelectItem value="distribuicao_lucros">Distribuição de lucros</SelectItem>
                  <SelectItem value="ajuste">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" min="0" value={retiradaForm.valor_calculado} onChange={(e) => setRetiradaForm({ ...retiradaForm, valor_calculado: Number(e.target.value) })} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Data prevista</Label>
            <Input type="date" value={retiradaForm.data_prevista} onChange={(e) => setRetiradaForm({ ...retiradaForm, data_prevista: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={retiradaForm.observacoes} onChange={(e) => setRetiradaForm({ ...retiradaForm, observacoes: e.target.value })} rows={2} />
          </div>
        </form>
      </FormModal>

      {/* Modal: gerar financeiro */}
      <FormModal
        open={!!gerarFinOpen}
        onClose={() => setGerarFinOpen(null)}
        title="Gerar lançamento financeiro"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setGerarFinOpen(null)}>Cancelar</Button>
            <Button onClick={handleGerarFinanceiro} disabled={saving}>Gerar</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {gerarFinOpen?.socios?.nome} — {TIPO_LABEL[gerarFinOpen?.tipo ?? ""]} — {formatCurrency(Number(gerarFinOpen?.valor_aprovado ?? gerarFinOpen?.valor_calculado ?? 0))}
          </p>
          <div className="space-y-1.5">
            <Label>Data de vencimento</Label>
            <Input type="date" value={gerarForm.data_vencimento} onChange={(e) => setGerarForm({ data_vencimento: e.target.value })} />
          </div>
        </div>
      </FormModal>

      {/* Modal: reabrir apuração */}
      <FormModal
        open={reabrirOpen}
        onClose={() => setReabrirOpen(false)}
        title="Reabrir apuração"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReabrirOpen(false)}>Cancelar</Button>
            <Button
              onClick={async () => {
                if (!apuracaoAtual || !reabrirMotivo.trim()) { toast.error("Informe o motivo"); return; }
                await reabrir.mutateAsync({ id: apuracaoAtual.id, motivo: reabrirMotivo });
                setReabrirMotivo(""); setReabrirOpen(false);
              }}
            >Reabrir</Button>
          </div>
        }
      >
        <div className="space-y-1.5">
          <Label>Motivo *</Label>
          <Textarea value={reabrirMotivo} onChange={(e) => setReabrirMotivo(e.target.value)} rows={3} placeholder="Justifique a reabertura..." />
        </div>
      </FormModal>
    </>
  );
}