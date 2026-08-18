# Aceite técnico — CT-e / NFS-e

Cenários obrigatórios desta entrega:

1. NFS-e com ISS retido: confirmação gera líquido do fornecedor e obrigação separada somente quando houver vencimento conhecido.
2. Repetir confirmação não duplica títulos.
3. Estornar e reconfirmar NFS-e preserva retenções históricas e recria apenas o conjunto operacional necessário.
4. CT-e com duas NF-e localizadas: rateio proporcional fecha exatamente no total do frete.
5. CT-e com qualquer NF-e ausente: financeiro pode ser confirmado, porém nenhum rateio parcial é aplicado.
6. Estorno CT-e remove exatamente o rateio ativo; reconfirmação não acumula valor.
7. NF-e importada posteriormente resolve referência pendente de CT-e pelo tenant correto.
8. XML CT-e/NFS-e preenche formulário sem confirmação automática.
9. XML original é arquivado quando Storage está disponível; falha de arquivamento não confirma o documento.
10. Distribuição CT-e e consulta ADN permanecem desligadas sem feature flag/configuração.

Os cenários 1–6 foram exercitados contra o Supabase de desenvolvimento com transações revertidas (`BEGIN/ROLLBACK`) para não persistir dados de teste. Parsers e helpers possuem cobertura unitária via Vitest.
