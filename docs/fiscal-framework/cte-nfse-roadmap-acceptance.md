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

## Hardening de integração

Antes do aceite final, a branch foi ajustada contra o schema real do Supabase e contra o pipeline completo do repositório:

- persistência do inbox/cursor CT-e isolada por acesso untyped somente onde os tipos gerados ainda não cobrem o uso dinâmico;
- metadados de certificado e plugin fiscal de exemplo alinhados ao `strict` TypeScript;
- consulta de conciliação alinhada aos campos reais da view financeira consolidada;
- lint fiscal/E2E corrigido sem desabilitar regras globalmente;
- assinatura da fixture Playwright preservada conforme a API do runner.

O job pgTAP é advisory e atualmente não chega aos testes: o `supabase db start` falha ao reproduzir migrations históricas anteriores a este roadmap. A investigação confirmou sucessivamente incompatibilidades de replay em migrations antigas; essas migrations já aplicadas foram mantidas intactas no PR para não reescrever histórico fora de escopo. A validação das novas migrations desta entrega foi feita diretamente no Supabase transitório, inclusive com transações revertidas.

`npm audit` e `touch-targets` também permanecem checks advisory do repositório e devem ser tratados como dívida técnica separada quando a falha não tiver sido introduzida por esta entrega.

O status **GO** depende dos checks bloqueantes do último ciclo de CI, da ausência de regressão E2E e das validações de banco descritas acima.
