
## Diagnóstico

### 1. Link público pobre vs. PDF
A `OrcamentoPublico.tsx` mostra apenas: cabeçalho com nome da empresa em texto, dados do cliente, tabela simplificada de itens (sem peso, sem desconto por linha, sem variação destacada), totais resumidos e ações. **Faltam vs. o PDF (`OrcamentoPdfTemplateBrand`)**:
- Logo da empresa (hoje só nome em texto)
- Endereço/contato completo da empresa (telefone, e-mail, IE, endereço completo)
- Coluna de **peso** e **peso total**
- Detalhamento de **descontos, ST, IPI, frete e outras despesas** (hoje só `valor_total`)
- **Subtotal** dos produtos antes de impostos/descontos
- Modalidade, condições de frete completas
- Visual menos institucional (sem cores da marca, sem rodapé com identificação)

### 2. Fluxo de e-mail confuso (bug real)
No `OrcamentoForm.tsx` (linhas 742-764, 1466-1485):
- O botão "Enviar e-mail" do dialog chama `buildPdfBlob()`.
- `buildPdfBlob` faz `setPreviewOpen(true)` para forçar o `OrcamentoPdfTemplate` a renderizar no DOM (porque ele só existe dentro do `<Dialog open={previewOpen}>`).
- Resultado visível ao usuário: o **dialog de pré-visualização do PDF abre por cima do dialog de e-mail**, fica aberto durante a captura, e o e-mail é enviado "às escondidas" enquanto o usuário pensa que precisa fechar a preview.
- Pior: o usuário não tem nenhum feedback claro do progresso (gerar PDF, fazer upload, criar URL assinada, enfileirar e-mail) — tudo acontece em silêncio com o preview ocupando a tela.

---

## Plano de execução (2 entregas)

### A) Link público — paridade visual com o PDF + logo

Reescrever `src/pages/OrcamentoPublico.tsx`:

1. **Carregar branding via `useBrandingPreview`** (hook já existente) para ter `logoUrl`, `marcaTexto`, `corPrimaria`, `corSecundaria`, ou usar `empresa_config.logo_url` direto (a página é anônima — vou conferir se a view expõe a URL do logo; caso negativo, leio `empresa_config` que já é lido hoje).
2. **Cabeçalho institucional** com:
   - Logo da empresa à esquerda (fallback para texto se ausente).
   - Razão social, CNPJ, IE, endereço completo, telefone, e-mail à direita.
   - Faixa colorida no topo usando `corPrimaria` (igual ao header do e-mail).
3. **Bloco do orçamento** (número, data, validade, status) com badge de status usando o `STATUS_VARIANT_MAP` (cores consistentes com o ERP).
4. **Bloco do cliente** (mantém o atual, mas reorganiza em duas colunas: identificação | endereço).
5. **Tabela de itens enriquecida**: `#`, Código, Descrição (+variação em pill), Qtd, Un., Peso unit., Peso total, Valor unit., **Desc. %**, Valor total. Em mobile, colapsa em cards (1 item por card) — segue padrão `comercial-mobile`.
6. **Totais detalhados** (mesma quebra do PDF):
   - Subtotal produtos
   - (–) Desconto
   - (+) ICMS-ST, IPI, Frete, Outras despesas
   - **Total geral** em destaque
   - Peso total, Quantidade total
7. **Condições comerciais** completas: pagamento, prazo de pagamento, prazo de entrega, modalidade frete, tipo frete, serviço de frete, observações.
8. **Rodapé institucional** com razão social + CNPJ + "Documento gerado eletronicamente".
9. **Ações de aprovação** (manter as atuais — botões verde/vermelho), com bloqueio quando expirado/já respondido.
10. **Botão "Baixar PDF"** no topo, opcional: gera o PDF no cliente reusando `OrcamentoPdfTemplateBrand`. _Se for complexo demais para a primeira iteração, deixo como evolução; o e-mail já entrega o link assinado._
11. **Atualizar `orcamentos_public_view`** se necessário (via migration) para expor as colunas faltantes: `peso_total`, `quantidade_total`, `desconto`, `imposto_st`, `imposto_ipi`, `frete_valor`, `outras_despesas`, `modalidade`, `servico_frete`. E `orcamentos_itens_public_view` para `peso_unitario`, `peso_total`, `desconto_percentual`. Conferir o que já existe antes de criar a migration.

### B) Fluxo de envio por e-mail — simplificar e dar feedback

1. **Renderizar o template PDF off-screen** (sempre montado, fora do `Dialog`):
   - Mover `<OrcamentoPdfTemplateBrand ref={pdfRef} ... />` para fora do `<Dialog open={previewOpen}>` em um wrapper `position: absolute; left: -10000px; top: 0` (off-screen mas no DOM).
   - O Dialog de preview passa a apenas exibir uma cópia ou referenciar o mesmo nó via portal/visual.
   - Resultado: `buildPdfBlob()` não precisa mais abrir o preview para conseguir capturar.
2. **Refatorar `buildPdfBlob`** para não tocar em `setPreviewOpen`. Apenas captura o nó off-screen.
3. **Reformular o dialog "Enviar orçamento por e-mail"** com 3 fases visuais e barra de progresso:
   - **Fase 1 — Composição** (estado padrão): destinatário (com possibilidade de **editar/adicionar e-mail** e adicionar **CC** opcional), assunto editável (default: `Orçamento {numero} — AviZee`), mensagem editável, checkbox "Anexar PDF (link de download válido por 30 dias)" marcado por padrão, preview compacto do que o cliente verá (cartão miniatura com logo + botão "Visualizar online" + link "Baixar PDF").
   - **Fase 2 — Enviando** (após clicar): stepper visual com 3 etapas: ① Gerando PDF → ② Subindo para armazenamento → ③ Enviando e-mail. Cada etapa muda de spinner para check. Botão "Cancelar" desabilitado.
   - **Fase 3 — Sucesso**: ícone de check, "E-mail enviado para fulano@x.com", mostra o link público copiável e botão "Fechar". Toast cross-module também.
4. **Botão "Reenviar por e-mail"** muda label conforme contexto:
   - Se o orçamento **nunca foi enviado** (sem registro em `email_send_log` para esse orçamento): "Enviar por e-mail".
   - Se já foi enviado: "Reenviar por e-mail" + tooltip mostrando data do último envio.
   - _Nota: para detectar isso de forma barata uso a coluna `ultimo_envio_email` no `orcamentos` (criar via migration) atualizada pela própria função `enviarOrcamentoPorEmail` no sucesso._
5. **Persistir mensagem padrão** em `app_configuracoes.geral.email_orcamento_template` (já contemplado pelo padrão Admin) com placeholders `{cliente}`, `{numero}`, `{validade}`, `{valor}` interpolados antes do envio. Cair em hardcoded se não configurado.
6. **Ajustar `enviarOrcamentoPorEmail`** em `src/services/orcamentos.service.ts` para:
   - Aceitar `assunto` opcional (passar para o template via `templateData.assunto` — exige acréscimo no template `orcamento-disponivel.tsx` na função `subject`).
   - Aceitar `cc` opcional (a edge function `send-transactional-email` precisa suportar; vou conferir e estender se necessário).
   - Atualizar `orcamentos.ultimo_envio_email = now()` ao concluir.
   - Emitir callbacks de progresso (via parâmetro `onStep?: (step: 'pdf'|'upload'|'email'|'done') => void`) para alimentar o stepper da UI.

### C) Detalhes técnicos a confirmar durante a execução
- Conferir colunas reais de `orcamentos_public_view` e `orcamentos_itens_public_view` (não tenho a definição em mãos) e estender via migration apenas o que faltar.
- Conferir `empresa_config.logo_url` está exposto para `anon` (a query atual em `OrcamentoPublico.tsx` já lê `empresa_config` direto — preciso garantir GRANT ou criar uma `empresa_config_public_view` segura com apenas as colunas institucionais).
- Conferir suporte a `cc` no `send-transactional-email`; se não houver, adicionar opcional sem quebrar template existente.

---

## Arquivos impactados

**Edição:**
- `src/pages/OrcamentoPublico.tsx` (reescrita visual)
- `src/pages/OrcamentoForm.tsx` (mover PDF off-screen, novo dialog em 3 fases, label dinâmico)
- `src/services/orcamentos.service.ts` (callbacks de progresso, assunto/cc, atualizar `ultimo_envio_email`)
- `supabase/functions/_shared/transactional-email-templates/orcamento-disponivel.tsx` (assunto dinâmico, eventual cc)
- `supabase/functions/send-transactional-email/index.ts` (suporte a `cc` se ausente — só se necessário)

**Criação:**
- Migration: estender `orcamentos_public_view` / `orcamentos_itens_public_view` se faltarem colunas; criar `empresa_config_public_view` com GRANT para `anon`; adicionar coluna `ultimo_envio_email TIMESTAMPTZ` em `orcamentos`.

---

## Confirmações antes de executar

1. **Botão "Baixar PDF" no link público** (item A.10): incluir agora ou deixar para próxima iteração? (gera o PDF no navegador do cliente — útil mas adiciona ~200KB de bundle no público).
2. **Campo CC opcional no envio**: incluir ou manter apenas destinatário único?
3. **Stepper de 3 fases** vs. uma barra de progresso simples + texto: qual prefere?

Posso aplicar?
