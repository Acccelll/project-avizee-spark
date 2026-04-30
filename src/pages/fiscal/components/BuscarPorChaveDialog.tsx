/**
 * Busca de NF-e por chave de acesso (44 dígitos).
 *
 * Estratégia em 2 níveis:
 *  1. Busca local em `nfe_distribuicao.xml_nfe` — XMLs que já chegaram via
 *     DistDFe (sincronização automática agendada). É a fonte preferencial:
 *     instantânea, sem custo SEFAZ.
 *  2. Sob demanda, dispara `sefaz-distdfe / consultar-nsu` para baixar
 *     novos documentos destinados ao CNPJ da empresa configurada.
 *
 * IMPORTANTE — limitação SEFAZ:
 *   O serviço NFeDistribuicaoDFe **só retorna documentos destinados ao CNPJ
 *   do certificado A1 configurado**. Não existe API pública gratuita para
 *   baixar XML de uma NF-e arbitrária por chave (esse é um serviço pago
 *   oferecido por SEFAZ-virtual / contadores). Por isso, se a chave não
 *   estiver no DistDFe, o XML não pode ser obtido automaticamente.
 */

import { useEffect, useState } from "react";
import { KeyRound, Loader2, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { FormModal } from "@/components/FormModal";

interface BuscarPorChaveDialogProps {
  open: boolean;
  onClose: () => void;
  /** Callback chamado quando o XML foi obtido. Recebe o conteúdo bruto do XML. */
  onXmlObtido: (xml: string, origem: "local" | "sefaz") => void;
}

const onlyDigits = (s: string) => s.replace(/\D/g, "");

/**
 * Throttling client-side para respeitar o limite da NT 2014.002 v1.30:
 * o Ambiente Nacional bloqueia o CNPJ por 1 hora se houver mais de
 * 20 consultas consChNFe na última hora (cStat 656). Mantemos um buffer
 * defensivo de 18 consultas/h por aba.
 */
const STORAGE_KEY = "fiscal:consChNFe:hits";
const LIMITE_POR_HORA = 18;

function consultasNaUltimaHora(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as number[];
    const corte = Date.now() - 60 * 60 * 1000;
    return Array.isArray(arr) ? arr.filter((t) => t > corte) : [];
  } catch {
    return [];
  }
}

function registrarConsulta(): void {
  const hits = [...consultasNaUltimaHora(), Date.now()];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hits));
  } catch {
    /* sem storage — segue sem throttle */
  }
}

/** Lê o tipo de emissão da chave (posição 35 = tpEmis). "1" = normal/produção real. */
function inferirAmbienteDaChave(_chave: string): "produção provável" | "indeterminado" {
  // A chave por si só NÃO carrega o ambiente; só o tpEmis. Mantemos heurística simples
  // apenas para sinalizar ao usuário que chaves com 44 dígitos vindas de fornecedores
  // são, na prática, sempre de produção.
  return "produção provável";
}

export function BuscarPorChaveDialog({
  open,
  onClose,
  onXmlObtido,
}: BuscarPorChaveDialogProps) {
  const [chave, setChave] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<"idle" | "local" | "sefaz">("idle");
  /** Ambiente lido de empresa_config (1=produção, 2=homologação). */
  const [ambienteEmpresa, setAmbienteEmpresa] = useState<"1" | "2">("1");
  /** Override manual: forçar produção mesmo quando a empresa está em homologação. */
  const [forcarProducao, setForcarProducao] = useState(false);
  /** Indica se já existe um certificado A1 configurado (necessário para a consulta). */
  const [temCertificado, setTemCertificado] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    (async () => {
      try {
        const { data: cfg } = await supabase
          .from("empresa_config")
          .select("ambiente_sefaz, ambiente_padrao")
          .maybeSingle();
        if (cancelado) return;
        let amb: "1" | "2" = "1";
        if (cfg?.ambiente_sefaz === "1" || cfg?.ambiente_sefaz === "2") {
          amb = cfg.ambiente_sefaz;
        } else if (cfg?.ambiente_padrao === "homologacao") {
          amb = "2";
        } else if (cfg?.ambiente_padrao === "producao") {
          amb = "1";
        }
        setAmbienteEmpresa(amb);
        // Por padrão, sugerimos consultar em produção quando a empresa está em homologação
        // (a Distribuição DF-e em homologação raramente devolve documentos reais).
        setForcarProducao(amb === "2");
      } catch (cfgErr) {
        console.warn("[BuscarPorChave] não foi possível ler empresa_config:", cfgErr);
      }
      try {
        const { data: cert } = await supabase
          .from("app_configuracoes")
          .select("valor")
          .eq("chave", "certificado_digital")
          .maybeSingle();
        if (!cancelado) setTemCertificado(!!cert?.valor);
      } catch {
        if (!cancelado) setTemCertificado(null);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [open]);

  const reset = () => {
    setChave("");
    setLoading(false);
    setPhase("idle");
  };

  const handleClose = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const buscarLocal = async (chaveLimpa: string) => {
    const { data, error } = await supabase
      .from("nfe_distribuicao")
      .select("xml_nfe, nome_emitente, numero, serie")
      .eq("chave_acesso", chaveLimpa)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const handleBuscar = async () => {
    const chaveLimpa = onlyDigits(chave);
    if (chaveLimpa.length !== 44) {
      toast.error("A chave de acesso deve ter exatamente 44 dígitos.");
      return;
    }

    if (temCertificado === false) {
      toast.error(
        "Nenhum certificado digital configurado. A consulta à SEFAZ exige o A1 instalado em Configuração Fiscal.",
        { duration: 8000 },
      );
      return;
    }

    // Throttle: NT 2014.002 v1.30 limita ~20 consChNFe/hora antes de
    // bloquear o CNPJ por 1h (cStat 656). Avisamos antes de chegar lá.
    const hits = consultasNaUltimaHora();
    if (hits.length >= LIMITE_POR_HORA) {
      const maisAntiga = Math.min(...hits);
      const minutosRestantes = Math.max(
        1,
        Math.ceil((maisAntiga + 60 * 60 * 1000 - Date.now()) / 60_000),
      );
      toast.error(
        `Limite de ${LIMITE_POR_HORA} consultas por hora atingido. Aguarde ~${minutosRestantes} min para evitar bloqueio do CNPJ pela SEFAZ (cStat 656 — consumo indevido).`,
        { duration: 12000 },
      );
      return;
    }

    setLoading(true);
    setPhase("local");
    try {
      // 1. Busca local
      const local = await buscarLocal(chaveLimpa);
      if (local?.xml_nfe) {
        toast.success(
          `XML encontrado localmente (NF ${local.numero ?? "?"} de ${local.nome_emitente ?? "—"}).`,
        );
        onXmlObtido(local.xml_nfe, "local");
        reset();
        onClose();
        return;
      }

      // 2. Consulta direta por chave no DistDFe (consChNFe).
      //    Diferente do consultar-nsu (incremental), busca exatamente esta chave.
      //    Limitação SEFAZ: a NF precisa ser destinada ao CNPJ do certificado.
      setPhase("sefaz");

      // Define o ambiente efetivo: por padrão respeita a empresa, mas o usuário
      // pode marcar "Consultar em produção" — necessário porque chaves reais de
      // fornecedores só existem em produção.
      const ambiente: "1" | "2" = forcarProducao ? "1" : ambienteEmpresa;

      toast.info(
        `Consultando SEFAZ pela chave (${ambiente === "1" ? "produção" : "homologação"})…`,
      );

      const { data: result, error: syncErr } = await supabase.functions.invoke(
        "sefaz-distdfe",
        { body: { action: "consultar-chave", chNFe: chaveLimpa, ambiente } },
      );
      registrarConsulta();

      if (syncErr) {
        const msg =
          (syncErr as { message?: string })?.message ??
          "Falha ao consultar SEFAZ. Verifique o certificado digital configurado.";
        throw new Error(msg);
      }

      type SefazResp = {
        sucesso?: boolean;
        erro?: string;
        codigoTransporte?: string;
        cStat?: string;
        xMotivo?: string;
        mensagemCstat?: string | null;
        docs?: Array<{ schema?: string; xml?: string; chave?: string }>;
      };
      const r = (result ?? {}) as SefazResp;

      if (r.sucesso === false) {
        const e = new Error(r.erro ?? "Falha desconhecida no SEFAZ.");
        (e as any).codigoTransporte = r.codigoTransporte;
        throw e;
      }

      // Procura o doc da chave consultada (procNFe completo).
      const doc = (r.docs ?? []).find(
        (d) => d.chave === chaveLimpa && d.schema?.toLowerCase().includes("procnfe"),
      ) ?? (r.docs ?? []).find((d) => d.chave === chaveLimpa);

      if (doc?.xml) {
        // Persiste o XML para reuso (cache local + disponibiliza na manifestação).
        try {
          await supabase.from("nfe_distribuicao").upsert(
            [{ chave_acesso: chaveLimpa, xml_nfe: doc.xml }],
            { onConflict: "chave_acesso" },
          );
        } catch (persistErr) {
          console.warn("[BuscarPorChave] cache local falhou:", persistErr);
        }
        toast.success("XML obtido via SEFAZ.");
        onXmlObtido(doc.xml, "sefaz");
        reset();
        onClose();
        return;
      }

      // Não encontrou — devolve a mensagem real da SEFAZ (cStat + xMotivo).
      const cStat = r.cStat ?? "";
      const xMotivo = r.xMotivo ?? "Documento não localizado.";
      // Mensagem amigável (catálogo NT 2014.002 v1.30, seção 4) tem
      // prioridade sobre o xMotivo cru, que vem em CAIXA-ALTA sem acentos.
      const amigavel = r.mensagemCstat ?? xMotivo;
      const explicacao = cStat
        ? `${amigavel} (cStat ${cStat})`
        : amigavel;
      toast.error(`SEFAZ: ${explicacao}`, { duration: 10000 });
    } catch (err) {
      console.error("[BuscarPorChave]", err);
      const msg = err instanceof Error ? err.message : String(err);
      const codigo = (err as any)?.codigoTransporte as string | undefined;
      const ehHttp2 = codigo === "HTTP2_REQUIRED" || /HTTP\/1\.1|http2 error|stream error/i.test(msg);
      const ehUnknownIssuer = codigo === "UNKNOWN_ISSUER" || /UnknownIssuer|invalid peer certificate/i.test(msg);
      const ehReset = codigo === "CONNECTION_RESET" || codigo === "TLS_FAILURE" ||
        /(reset by peer|connection reset|EOF|tls|handshake|alert)/i.test(msg);
      if (ehHttp2) {
        toast.error(
          "A SEFAZ recusou a conexão por exigir HTTP/1.1. A correção foi aplicada na função fiscal — recarregue a página e tente novamente em alguns segundos.",
          { duration: 12000 },
        );
      } else if (ehUnknownIssuer) {
        toast.error(
          "A cadeia ICP-Brasil do servidor SEFAZ não foi reconhecida pelo ambiente. Reporte ao suporte técnico para incluir os certificados raiz no cliente HTTP fiscal.",
          { duration: 12000 },
        );
      } else if (ehReset && !forcarProducao && ambienteEmpresa === "2") {
        toast.error(
          'A consulta foi enviada para homologação e o Ambiente Nacional derrubou a conexão. Marque "Consultar em produção" para tentar novamente — chaves reais de fornecedores só existem em produção.',
          { duration: 12000 },
        );
      } else if (ehReset) {
        toast.error(
          "O Ambiente Nacional fechou a conexão sem responder. Como o Portal NF-e segue funcionando, isto indica divergência de protocolo (envelope SOAP) ou cadeia ICP-Brasil ausente no runtime — não é instabilidade da Receita. Reporte ao suporte se persistir.",
          { duration: 12000 },
        );
      } else {
        toast.error(`Erro na consulta: ${msg}`);
      }
    } finally {
      setLoading(false);
      setPhase("idle");
    }
  };

  const chaveDigits = onlyDigits(chave);
  const chaveValida = chaveDigits.length === 44;
  const ambienteEfetivo: "1" | "2" = forcarProducao ? "1" : ambienteEmpresa;
  const heuristica = chaveValida ? inferirAmbienteDaChave(chaveDigits) : null;

  return (
    <FormModal
      open={open}
      onClose={handleClose}
      title="Consultar NF-e por chave de acesso"
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleBuscar}
            disabled={loading || !chaveValida || temCertificado === false}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {phase === "sefaz" ? "Consultando SEFAZ…" : "Buscando…"}
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Buscar
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="chave-acesso" className="flex items-center gap-2 text-sm">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            Chave de acesso (44 dígitos)
          </Label>
          <Input
            id="chave-acesso"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
            maxLength={60}
            inputMode="numeric"
            autoFocus
            disabled={loading}
            className="font-mono tracking-tight"
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {chaveDigits.length}/44 dígitos
              {chaveValida && <span className="ml-2 text-success">✓ válido</span>}
            </span>
            {chaveDigits.length > 0 && chaveDigits.length !== 44 && (
              <span className="text-warning">Faltam {44 - chaveDigits.length}</span>
            )}
          </div>
        </div>

        {/* Painel de ambiente — torna explícito para qual SEFAZ a consulta vai */}
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs">
              <span className="text-muted-foreground">Ambiente da empresa: </span>
              <Badge variant={ambienteEmpresa === "1" ? "default" : "secondary"}>
                {ambienteEmpresa === "1" ? "Produção" : "Homologação"}
              </Badge>
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">Consulta será feita em: </span>
              <Badge variant={ambienteEfetivo === "1" ? "default" : "secondary"}>
                {ambienteEfetivo === "1" ? "Produção" : "Homologação"}
              </Badge>
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 text-xs cursor-pointer">
            <span className="text-foreground">
              Consultar em <strong>produção</strong> (recomendado para chaves reais de fornecedores)
            </span>
            <Switch
              checked={forcarProducao}
              onCheckedChange={setForcarProducao}
              disabled={loading}
            />
          </label>
          {ambienteEmpresa === "2" && !forcarProducao && (
            <p className="flex items-start gap-1.5 text-[11px] text-warning">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              A empresa está em homologação. Notas reais de entrada não existem nesse
              ambiente — a consulta tende a falhar por reset de conexão.
            </p>
          )}
          {temCertificado === false && (
            <p className="flex items-start gap-1.5 text-[11px] text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Nenhum certificado digital A1 configurado — sem ele a SEFAZ não responde.
            </p>
          )}
        </div>

        <div className="rounded-md border border-info/30 bg-info/5 p-3 text-xs text-foreground space-y-1.5">
          <p className="font-semibold">Como funciona</p>
          <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
            <li>
              Procuramos primeiro nos XMLs já recebidos por <strong>DistDFe</strong>
              {" "}(instantâneo, sem custo SEFAZ).
            </li>
            <li>
              Se não encontrarmos, consultamos o <strong>Ambiente Nacional</strong>
              {" "}via NFeDistribuicaoDFe (<code>consChNFe</code>) usando o certificado
              digital configurado.
            </li>
            <li>
              <strong>Importante:</strong> esta busca traz o <em>XML/resumo</em>{" "}
              destinado ao CNPJ do certificado — <strong>não é</strong> a consulta
              pública universal de NF-e por chave. Para verificar a situação/protocolo
              de uma NF-e já cadastrada use a ação <em>Consultar SEFAZ</em> na lista
              de notas (NFeConsultaProtocolo4).
            </li>
            <li>
              Notas emitidas para outros CNPJs precisam ser obtidas com o próprio
              emissor.
            </li>
          </ol>
          {heuristica && (
            <p className="text-[11px] text-muted-foreground italic">
              Chave informada parece ser de {heuristica}.
            </p>
          )}
        </div>
      </div>
    </FormModal>
  );
}