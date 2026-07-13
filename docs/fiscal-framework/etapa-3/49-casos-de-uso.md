# 49 · Casos de uso

Padrão de ficha:

```
UC-XXX Nome
  Objetivo · Atores · Pré-condições · Fluxo principal · Alternativos · Exceções · Resultado esperado · RN
```

## UC-001 · Emitir NF-e única (venda)
- **Atores**: Vendedor.
- **Pré-cond**: pedido faturado; empresa+cert configurados; permissão `fiscal:emitir`.
- **Fluxo**: usuário confirma emissão → sistema serializa → assina → transmite → cStat=100 → grava nota → notifica → baixa estoque → gera financeiro.
- **Alternativos**: cStat=103 (lote em processamento) → interface indica "em processamento" → cron consulta retorno em ≤ 1min.
- **Exceções**: cert expirado (RN-156) → bloqueia com msg; SEFAZ down → sugere retry ou contingência (`fiscal:admin`).
- **Resultado**: chave + protocolo exibidos; PDF DANFE disponível.
- **RN**: 001–020, 040.

## UC-002 · Emitir lote de NF-e (batch)
- **Atores**: Faturamento.
- **Pré-cond**: seleção de N pedidos.
- **Fluxo**: loop serial por pedido chamando UC-001; painel mostra progresso; falhas destacadas.
- **Alternativo**: > 20 pedidos → enfileira em `fiscal.emissao.lote` (v2).
- **Exceção**: primeira falha por auth/cert → interrompe lote.
- **RN**: 001–020, 190–196.

## UC-003 · Consultar situação de nota
- **Atores**: Vendedor, Financeiro, Auditor.
- **Fluxo**: informa chave → sistema consulta SEFAZ → exibe cStat + protocolo/dh.
- **RN**: 030–035.

## UC-004 · Baixar XML
- **Atores**: Vendedor, Contador (via interface).
- **Fluxo**: seleciona nota → sistema devolve URL signed 10min → download.
- **Alternativo**: nota de destinatário sem XML local → dispara UC-009.
- **RN**: 040.

## UC-005 · Importar XML (NF de fornecedor)
- **Atores**: Comprador.
- **Fluxo**: upload → parse → dedupe → resolve fornecedor/produto → grava.
- **Alternativo**: ZIP → fila; produtos ausentes → cadastro rápido inline.
- **Exceção**: assinatura inválida → aborta com msg.
- **RN**: 050–058.

## UC-006 · Cancelar NF-e
- **Atores**: Vendedor autorizado.
- **Pré-cond**: nota Autorizada, < 24h.
- **Fluxo**: preenche justificativa → confirma → sistema envia evento → cStat=135 → nota `Cancelada` → estorna estoque/financeiro (se aplicável).
- **Exceção**: > 24h → cStat=155 → bloqueia com msg orientando substituição.
- **RN**: 080–086.

## UC-007 · Emitir CCe
- **Atores**: Vendedor.
- **Fluxo**: escreve correção (15..1000 chars) → envia → cStat=135 → CCe registrada.
- **Exceção**: > 20 CCe (RN-094) → bloqueia; tenta corrigir campo proibido → bloqueia com aviso.
- **RN**: 090–096.

## UC-008 · Inutilizar numeração
- **Atores**: Admin fiscal.
- **Pré-cond**: faixa não emitida.
- **Fluxo**: informa (ano, série, nI, nF, justificativa) → envia → cStat=102 → registra.
- **Exceção**: número já emitido → bloqueia; > 30d fim de mês → alerta e exige confirmação.
- **RN**: 100–104.

## UC-009 · Sincronizar DFe
- **Atores**: sistema (cron); admin (manual).
- **Fluxo**: cursor NSU → loop distDFe → decodifica docZip → grava → auto-ciência opcional.
- **Exceção**: cStat=656 → aumenta intervalo 60min.
- **RN**: 110–120.

## UC-010 · Manifestar destinatário
- **Atores**: Financeiro/Compras autorizado.
- **Fluxo**: seleciona nota recebida → escolhe tipo → envia evento → registra.
- **Exceção**: prazo vencido; sequência já existente.
- **RN**: 070–078.

## UC-011 · Consultar cadastro SEFAZ
- **Atores**: Vendedor (autocomplete de cliente); Compras.
- **Fluxo**: informa UF+CNPJ → sistema consulta → exibe dados/situação.
- **Exceção**: UF não suporta → mensagem clara.
- **RN**: 130.

## UC-012 · Consultar status serviço
- **Atores**: sistema (breaker); admin (dashboard).
- **Fluxo**: consulta por UF+ambiente → exibe cStat + tempo médio.
- **RN**: 140.

## UC-013 · Upload certificado A1
- **Atores**: Admin.
- **Fluxo**: upload .pfx + senha → parse (valida senha, CNPJ, validade) → salva bucket + Vault → confirma.
- **Exceção**: senha errada; CNPJ divergente; expirado; corrompido.
- **RN**: 150–158.

## UC-014 · Rotacionar certificado A1
- **Atores**: Admin.
- **Fluxo**: upload novo .pfx → substitui vigente → alerta 30d passa a considerar novo.
- **RN**: 153.

## UC-015 · Alertar certificado vencendo
- **Atores**: sistema (cron).
- **Fluxo**: cron diário verifica → dispara `CertificadoProximoDoVencimento` → notifica admin.
- **RN**: 152, 185.

## UC-016 · Configurar empresa fiscal
- **Atores**: Admin.
- **Fluxo**: preenche CNPJ/IE/CRT/série/ambiente → salva → publica `EmpresaFiscalConfigurada`.
- **Exceção**: alteração de CNPJ → confirma re-onboarding.
- **RN**: 160–166.

## UC-017 · Alterar runtime config (timeouts, retry, auto-ciência)
- **Atores**: Admin fiscal.
- **Fluxo**: edita e salva; auditado.
- **RN**: 164, 165, 174.

## UC-018 · Consultar rastro fiscal por correlation_id
- **Atores**: Auditor.
- **Fluxo**: informa correlationId → sistema retorna timeline completa.
- **RN**: 170–175, LGPD 610.

## UC-019 · Consultar histórico de uma nota
- **Atores**: Vendedor, Auditor.
- **Fluxo**: seleciona chave → exibe eventos + auditoria + XML links.
- **RN**: 170–175.

## UC-020 · Dashboard de saúde fiscal
- **Atores**: Admin, Gestor.
- **Fluxo**: acessa `/admin/fiscal/health` → vê SEFAZ cStat, filas, certificados, últimos rejeitados.
- **RN**: 180–185.

## UC-021 · Silenciar alerta
- **Atores**: Admin.
- **Fluxo**: escolhe alerta → informa motivo → silencia por 24h.
- **RN**: 182.

## UC-022 · Reprocessar mensagem em DLQ
- **Atores**: Admin fiscal (v2).
- **Fluxo**: seleciona mensagem em `pgmq.a_*` → reenfileira → auditado.
- **RN**: 196.

## UC-023 · Forçar retry manual
- **Atores**: Admin fiscal.
- **Fluxo**: seleciona nota em `RejeitadaDefinitiva` → clica "Forçar retry" → confirma → sistema reseta contador e re-executa.
- **RN**: 195.

## UC-024 · Ativar contingência (SVC-AN)
- **Atores**: Admin fiscal.
- **Fluxo**: dashboard alerta SEFAZ down > 15min → admin decide ativar → confirma modo → sistema chaveia envio para SVC-AN.
- **RN**: 200–204.

## UC-025 · Encerrar contingência
- **Atores**: Admin fiscal.
- **Fluxo**: SEFAZ voltou → admin encerra → sistema entra em `RegularizacaoPendente` → transmite notas em contingência para o autorizador principal.
- **RN**: 210.

## UC-026 · Exportar XMLs por período (contador)
- **Atores**: Financeiro/Admin.
- **Fluxo**: escolhe filtro → sistema enfileira → notifica quando pronto → download ZIP.
- **RN**: 220–224.

## UC-027 · Validar XML standalone
- **Atores**: Dev/Admin.
- **Fluxo**: upload XML → sistema valida XSD + regras → exibe violações.
- **RN**: 230.

## UC-028 · Assinar XML standalone
- **Atores**: Dev/Admin (testes).
- **Fluxo**: upload XML + cert (padrão empresa) → sistema assina → download.
- **RN**: 240.

## UC-029 · Atualizar endpoint SEFAZ
- **Atores**: Admin fiscal.
- **Fluxo**: SQL admin ou UI futura → altera linha em `fiscal_endpoints` → publica `EndpointAlterado` → notifica.
- **RN**: 250.

## UC-030 · Publicar novo PL/XSD
- **Atores**: Admin fiscal.
- **Fluxo**: upload XSDs → cria linha `fiscal_schemas_pl` com vigência → sistema passa a validar por novo PL.
- **RN**: 260.

## UC-031 · Consumir NF-e como fornecedor via DFe (auto-ciência opt-in)
- **Atores**: sistema.
- **Fluxo**: DFe entrega nota → auto-ciência ativa → sistema envia ciência automaticamente.
- **RN**: 116, 165.

## UC-032 · Regularizar contingência
- **Atores**: sistema (cron); admin (visão).
- **Fluxo**: após encerrar contingência, sistema transmite notas SVC ao autorizador principal (nova autorização com mesma chave? — verificar regra SEFAZ; documento fica em `AUTORIZADA_CONTINGENCIA`).
- **RN**: 200–210.

## UC-033 · Excluir dado pessoal (LGPD)
- **Atores**: DPO.
- **Fluxo**: recebe solicitação → sistema responde base legal (obrigação fiscal 5 anos) → agenda anonimização após 5 anos.
- **RN**: 600–603.

## UC-034 · Assinatura sob nova suíte (RSA-SHA256)
- **Atores**: sistema (quando SEFAZ NT permitir).
- **Fluxo**: flag `fiscal:v2:sign-sha256` ligado → framework usa nova suíte.
- **RN**: 007.

## UC-035 · Migrar de sefaz-proxy para fiscal-nfe (strangler)
- **Atores**: Admin dev.
- **Fluxo**: liga flag `fiscal:v2:autorizacao` para empresa X → nova pipeline; verifica auditoria; rollback flag se necessário.
- **RN**: ADR-016.

## Priorização por milestone

| Milestone | UCs |
|---|---|
| Etapa 4 | UC-001, UC-003, UC-004, UC-012, UC-016, UC-020, UC-035 |
| Etapa 5 | UC-006, UC-007, UC-008, UC-010 |
| Etapa 6 | UC-009, UC-005, UC-031 |
| Etapa 7 | UC-015, UC-021, UC-022, UC-023 |
| Etapa 8 | UC-013, UC-014 |
| Etapa 11+ | UC-024, UC-025, UC-032 (contingência) |
| v3 | UC-026, UC-033 (LGPD anonimização batch) |