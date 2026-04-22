import { useMemo } from "react";
import { ViewDrawerV2, ViewField, ViewSection } from "@/components/ViewDrawerV2";
import { DrawerSummaryCard, DrawerSummaryGrid } from "@/components/ui/DrawerSummaryCard";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { useSocioParticipacoes, useSociosRetiradas } from "@/hooks/useSocios";
import type { Socio, SocioParticipacao, SocioRetirada } from "@/types/domain";

interface Props {
  open: boolean;
  onClose: () => void;
  socio: Socio | null;
  onEdit?: (s: Socio) => void;
}

const tipoLabel: Record<string, string> = {
  pro_labore: "Pró-labore",
  bonus: "Bônus",
  distribuicao_lucros: "Distribuição",
  ajuste: "Ajuste",
};

export function SocioDrawer({ open, onClose, socio, onEdit }: Props) {
  const { participacoes } = useSocioParticipacoes(socio?.id);
  const { retiradas } = useSociosRetiradas(socio ? { socioId: socio.id } : undefined);

  const totais = useMemo(() => {
    const acc = { totalRetirado: 0, proLabore: 0, bonus: 0, distribuicao: 0, pendentes: 0 };
    for (const r of retiradas) {
      const v = Number(r.valor_aprovado ?? r.valor_calculado ?? 0);
      if (r.status === "cancelado") continue;
      if (r.status === "pago" || r.status === "financeiro_gerado" || r.status === "aprovado") {
        acc.totalRetirado += v;
        if (r.tipo === "pro_labore") acc.proLabore += v;
        if (r.tipo === "bonus") acc.bonus += v;
        if (r.tipo === "distribuicao_lucros") acc.distribuicao += v;
      }
      if (r.status === "rascunho" || r.status === "aprovado") acc.pendentes += 1;
    }
    return acc;
  }, [retiradas]);

  if (!socio) return null;

  const participacaoVigente = participacoes.find((p) => !p.vigencia_fim) ?? participacoes[0];

  const summary = (
    <DrawerSummaryGrid cols={4}>
      <DrawerSummaryCard
        label="Participação atual"
        value={`${Number(socio.percentual_participacao_atual ?? 0).toFixed(2)}%`}
        tone="primary"
      />
      <DrawerSummaryCard label="Pró-labore (acum.)" value={formatCurrency(totais.proLabore)} />
      <DrawerSummaryCard
        label="Bônus + Distribuição"
        value={formatCurrency(totais.bonus + totais.distribuicao)}
      />
      <DrawerSummaryCard
        label="Total retirado"
        value={formatCurrency(totais.totalRetirado)}
        tone="success"
      />
    </DrawerSummaryGrid>
  );

  const tabs = [
    {
      value: "resumo",
      label: "Resumo",
      content: (
        <div className="space-y-5">
          <ViewSection title="Identificação">
            <div className="grid grid-cols-2 gap-4">
              <ViewField label="Nome">{socio.nome}</ViewField>
              <ViewField label="CPF">{socio.cpf || "—"}</ViewField>
              <ViewField label="E-mail">{socio.email || "—"}</ViewField>
              <ViewField label="Telefone">{socio.telefone || "—"}</ViewField>
              <ViewField label="Data de entrada">
                {socio.data_entrada ? formatDate(socio.data_entrada) : "—"}
              </ViewField>
              <ViewField label="Data de saída">
                {socio.data_saida ? formatDate(socio.data_saida) : "—"}
              </ViewField>
            </div>
          </ViewSection>

          <ViewSection title="Recebimento">
            <div className="grid grid-cols-2 gap-4">
              <ViewField label="Forma padrão">
                {socio.forma_recebimento_padrao || "—"}
              </ViewField>
              <ViewField label="Chave Pix">{socio.chave_pix || "—"}</ViewField>
              <ViewField label="Banco">{socio.banco || "—"}</ViewField>
              <ViewField label="Agência / Conta">
                {[socio.agencia, socio.conta].filter(Boolean).join(" / ") || "—"}
              </ViewField>
              <ViewField label="Tipo de conta">{socio.tipo_conta || "—"}</ViewField>
              <ViewField label="Status">
                <StatusBadge status={socio.ativo ? "ativo" : "inativo"} />
              </ViewField>
            </div>
          </ViewSection>

          {participacaoVigente && (
            <ViewSection title="Vigência atual">
              <div className="grid grid-cols-3 gap-4">
                <ViewField label="Percentual">
                  {Number(participacaoVigente.percentual).toFixed(2)}%
                </ViewField>
                <ViewField label="Início">
                  {formatDate(participacaoVigente.vigencia_inicio)}
                </ViewField>
                <ViewField label="Fim">
                  {participacaoVigente.vigencia_fim
                    ? formatDate(participacaoVigente.vigencia_fim)
                    : "Em aberto"}
                </ViewField>
              </div>
            </ViewSection>
          )}
        </div>
      ),
    },
    {
      value: "participacoes",
      label: `Participações (${participacoes.length})`,
      content: (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Percentual</th>
                <th className="text-left p-3 font-medium">Início</th>
                <th className="text-left p-3 font-medium">Fim</th>
                <th className="text-left p-3 font-medium">Observações</th>
              </tr>
            </thead>
            <tbody>
              {participacoes.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    Nenhum histórico de participação
                  </td>
                </tr>
              )}
              {participacoes.map((p: SocioParticipacao) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="p-3 font-mono">{Number(p.percentual).toFixed(2)}%</td>
                  <td className="p-3">{formatDate(p.vigencia_inicio)}</td>
                  <td className="p-3">
                    {p.vigencia_fim ? formatDate(p.vigencia_fim) : <Badge variant="outline">Vigente</Badge>}
                  </td>
                  <td className="p-3 text-muted-foreground">{p.observacoes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    {
      value: "retiradas",
      label: `Retiradas (${retiradas.length})`,
      content: (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Eventos rastreáveis (pró-labore, bônus, distribuição). Cancelados não somam totais.
            </p>
            <RelationalLink to="/socios-participacoes" behavior="route">
              Abrir Sócios e Participações
            </RelationalLink>
          </div>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Competência</th>
                  <th className="text-left p-3 font-medium">Tipo</th>
                  <th className="text-right p-3 font-medium">Valor</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-left p-3 font-medium">Financeiro</th>
                </tr>
              </thead>
              <tbody>
                {retiradas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      Nenhuma retirada registrada
                    </td>
                  </tr>
                )}
                {retiradas.map((r: SocioRetirada) => {
                  const valor = Number(r.valor_aprovado ?? r.valor_calculado ?? 0);
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="p-3">{formatDate(r.competencia)}</td>
                      <td className="p-3">{tipoLabel[r.tipo] ?? r.tipo}</td>
                      <td className="p-3 text-right font-mono">{formatCurrency(valor)}</td>
                      <td className="p-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="p-3">
                        {r.financeiro_lancamento_id ? (
                          <RelationalLink
                            to={`/financeiro/${r.financeiro_lancamento_id}`}
                            behavior="route"
                          >
                            Ver lançamento
                          </RelationalLink>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      value: "observacoes",
      label: "Observações",
      content: (
        <div className="rounded-lg border bg-muted/20 p-4 text-sm whitespace-pre-wrap text-foreground/90 min-h-[120px]">
          {socio.observacoes?.trim() || (
            <span className="text-muted-foreground">Sem observações cadastradas.</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <ViewDrawerV2
      open={open}
      onClose={onClose}
      title={socio.nome}
      subtitle={socio.cpf ? `CPF ${socio.cpf}` : "Sócio"}
      summary={summary}
      actions={
        onEdit && (
          <Button size="sm" variant="outline" onClick={() => onEdit(socio)} className="gap-2">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        )
      }
      tabs={tabs}
      defaultTab="resumo"
      variant="view"
    />
  );
}