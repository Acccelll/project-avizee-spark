# 17 · Oportunidades de melhoria (arquitetura alvo > framework original)

O objetivo aqui é listar o que a arquitetura alvo do AVIZEE **melhora** em
relação ao FiscalFramework .NET de referência, aproveitando o ambiente
integrado Lovable Cloud.

## 1. Idempotência first-class no banco
O framework .NET explicitamente não persiste (ADR-08 dele). O alvo AVIZEE
usa constraints UNIQUE em `notas_fiscais`, `nota_fiscal_eventos`,
`nfe_distribuicao` e `inutilizacoes_numeracao`. Retry pós-crash não duplica
**por regra do schema**, não por convenção de código.

## 2. RLS por empresa embutida
Segregação multi-tenant vai além do framework original (single-instance por
CNPJ). Postgres RLS + `empresa_id` em todos os contratos garante isolamento
na camada de dados, mesmo sob bug de aplicação.

## 3. Observabilidade centralizada
Correlation-id + `fiscal_auditoria` + `fiscal_telemetria` + edge logs no
mesmo provider. Um `SELECT` responde "o que aconteceu neste envio?".
O framework .NET original deixa isso para o hospedeiro.

## 4. Endpoint registry com audit trail via migration
Além de tabela declarativa (paridade com o .NET), toda mudança de URL vira
migration versionada, revisada, rollbackable, com autor identificado.

## 5. Fila declarativa por operação (pgmq)
O framework .NET não tem fila embutida. AVIZEE tem pgmq nativo do Postgres,
consumido por cron edge — reduz um serviço externo por completo.

## 6. Validação de assinatura na importação
O framework .NET expõe `ISignatureValidator`, mas a decisão de usar é do
chamador. No AVIZEE, importação de XML **sempre** valida — regra da edge
`fiscal-nfe /importar`. XMLs adulterados são rejeitados no ponto de entrada.

## 7. Vault para senha do certificado
O framework .NET deixa o chamador decidir onde guardar a senha. AVIZEE usa
Vault com RPC SECURITY DEFINER — a senha nunca aparece em código de
aplicação após o upload.

## 8. Bucket + Storage nativos para XSDs versionados
`fiscal_schemas_pl` + prefixo por PL permite múltiplas versões vigentes
simultaneamente sem redeploy. O framework .NET assume diretório local.

## 9. UI unificada de manifestação
O drawer de manifestação (`ManifestacaoDestinatarioDrawer`) já existe;
ganha ciência automática, alerta de vencimento (135d) e batch nativos.
O framework .NET só expõe a API — UX fica com quem hospeda.

## 10. Preparação para NFS-e desde o design
O framework original é NF-e-cêntrico na v0.21 e assume SOAP. NFS-e nacional
(padrão ABRASF v2.04) usa REST/JSON. O `ITransportChannel` do AVIZEE já é
genérico o suficiente para acomodar.

## 11. Feature flag por operação
Migração da camada antiga para a nova via flag por operação
(`fiscal:v2:autorizacao`, `fiscal:v2:distdfe`). Corte gradual + rollback
em 1 clique. O framework .NET é "all or nothing" ao substituir uma edge.

## 12. Custo operacional zero
Sem VPS/Azure/Render; sem contrato de SLA extra; sem monitoramento externo.
Tudo dentro do Lovable Cloud que a empresa já paga.

## 13. Consulta cadastro reaproveitando ViaCEP/CNPJ
A tela de cadastro já usa APIs externas. Consulta cadastro SEFAZ vira apenas
mais uma fonte para o mesmo formulário, complementando com IE + regime.

## 14. DANFE pré-existente
`danfe.service.ts` renderiza; migração para nova camada não precisa recriar.
DACTE/DAMDFE seguirão o mesmo padrão.

## 15. Dashboard fiscal já em produção
`dashboardFiscal.service.ts` e `dashboardFiscalPdf.service.ts` só ganham
dados novos (badges de status SEFAZ, latência, rejeições por cStat) — não
precisam ser reescritos.