from pathlib import Path


def patch(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"pattern not found in {path}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


# Social: datasets that feed XLSX exports must not inherit the PostgREST row cap.
patch(
    "src/services/social.service.ts",
    "import { getSocialProvider } from './socialProviders';\n",
    "import { getSocialProvider } from './socialProviders';\nimport { fetchAllPages, REPORT_HARD_CAP } from '@/services/_lib/fetchAllPages';\n",
)

patch(
    "src/services/social.service.ts",
    """export async function listarPostsFiltrados(filtros: SocialPostFilters): Promise<SocialPost[]> {
  const { data, error } = await supabase.rpc('social_posts_filtrados', {
    _data_inicio: filtros.dataInicio,
    _data_fim: filtros.dataFim,
    _conta_id: filtros.campanhaId ?? null,
  });
  if (error) throw error;
  return (data ?? []) as unknown as SocialPost[];
}""",
    """export async function listarPostsFiltrados(filtros: SocialPostFilters): Promise<SocialPost[]> {
  let truncated = false;
  const rows = await fetchAllPages<SocialPost>(
    () => supabase.rpc('social_posts_filtrados', {
      _data_inicio: filtros.dataInicio,
      _data_fim: filtros.dataFim,
      _conta_id: filtros.campanhaId ?? null,
    }),
    { onTruncated: () => { truncated = true; } },
  );
  if (truncated) {
    throw new Error(
      `O relatório social excede o limite seguro de ${REPORT_HARD_CAP.toLocaleString('pt-BR')} posts. Reduza o período ou aplique filtros.`,
    );
  }
  return rows;
}""",
)

patch(
    "src/services/social.service.ts",
    """export async function listarAlertas(resolvido?: boolean): Promise<SocialAlerta[]> {
  const today = new Date();
  const ago = new Date(today);
  ago.setDate(today.getDate() - 30);
  const { data, error } = await supabase.rpc('social_alertas_periodo', {
    _data_inicio: ago.toISOString().slice(0, 10),
    _data_fim: today.toISOString().slice(0, 10),
  });
  if (error) throw error;
  const rows = (data ?? []) as unknown as SocialAlerta[];
  if (typeof resolvido === 'boolean') {
    return rows.filter((a) => a.resolvido === resolvido);
  }
  return rows;
}""",
    """export async function listarAlertas(resolvido?: boolean): Promise<SocialAlerta[]> {
  const today = new Date();
  const ago = new Date(today);
  ago.setDate(today.getDate() - 30);
  let truncated = false;
  const rows = await fetchAllPages<SocialAlerta>(
    () => supabase.rpc('social_alertas_periodo', {
      _data_inicio: ago.toISOString().slice(0, 10),
      _data_fim: today.toISOString().slice(0, 10),
    }),
    { onTruncated: () => { truncated = true; } },
  );
  if (truncated) {
    throw new Error(
      `O relatório social excede o limite seguro de ${REPORT_HARD_CAP.toLocaleString('pt-BR')} alertas. Reduza o período.`,
    );
  }
  if (typeof resolvido === 'boolean') {
    return rows.filter((a) => a.resolvido === resolvido);
  }
  return rows;
}""",
)

# Workbook: screen keeps last 50, CSV export loads full history only on demand.
patch(
    "src/services/workbook/workbookGenerator.service.ts",
    'import { logger } from "@/lib/logger";\n',
    'import { logger } from "@/lib/logger";\nimport { fetchAllPages, REPORT_HARD_CAP } from \'@/services/_lib/fetchAllPages\';\n',
)

patch(
    "src/services/workbook/workbookGenerator.service.ts",
    """export async function listarGeracoes(): Promise<WorkbookGeracao[]> {
  const { data, error } = await fromUntyped('workbook_geracoes')
    .select('*, workbook_templates(nome, versao)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as WorkbookGeracao[];
}
""",
    """export async function listarGeracoes(): Promise<WorkbookGeracao[]> {
  const { data, error } = await fromUntyped('workbook_geracoes')
    .select('*, workbook_templates(nome, versao)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as WorkbookGeracao[];
}

export async function listarTodasGeracoes(): Promise<WorkbookGeracao[]> {
  let truncated = false;
  const rows = await fetchAllPages<WorkbookGeracao>(
    () => fromUntyped('workbook_geracoes')
      .select('*, workbook_templates(nome, versao)')
      .order('created_at', { ascending: false }),
    { onTruncated: () => { truncated = true; } },
  );
  if (truncated) {
    throw new Error(
      `O histórico excede o limite seguro de ${REPORT_HARD_CAP.toLocaleString('pt-BR')} gerações.`,
    );
  }
  return rows;
}
""",
)

patch(
    "src/pages/WorkbookGerencial.tsx",
    """  listarGeracoes,
  gerarWorkbook,""",
    """  listarGeracoes,
  listarTodasGeracoes,
  gerarWorkbook,""",
)

patch(
    "src/pages/WorkbookGerencial.tsx",
    """  const handleExportCsv = () => {
    if (!geracoes.length) {
      toast.info('Sem gerações para exportar.');
      return;
    }
    const csv = buildHistoricoCsv(geracoes);
    const blob = new Blob([`\\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    downloadBlob(
      blob,
      `workbook_historico_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success('CSV exportado.');
  };""",
    """  const handleExportCsv = async () => {
    if (!geracoes.length) {
      toast.info('Sem gerações para exportar.');
      return;
    }
    try {
      const todasGeracoes = await listarTodasGeracoes();
      const csv = buildHistoricoCsv(todasGeracoes);
      const blob = new Blob([`\\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
      downloadBlob(
        blob,
        `workbook_historico_${new Date().toISOString().slice(0, 10)}.csv`,
      );
      toast.success(`CSV exportado com ${todasGeracoes.length.toLocaleString('pt-BR')} gerações.`);
    } catch (err) {
      toast.error(`Erro ao exportar histórico: ${err instanceof Error ? err.message : String(err)}`);
    }
  };""",
)

print("Social and Workbook export audit patch applied")
