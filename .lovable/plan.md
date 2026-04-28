
## Viabilidade

Sim — é viável. Já temos no projeto:
- **Credenciais contratuais ativas** (`CORREIOS_API_KEY`, `CORREIOS_CONTRATO`, `CORREIOS_CARTAO_POSTAGEM`, `CORREIOS_USER`) e a edge function `correios-api` que autentica com sucesso na API REST oficial (`api.correios.com.br/token/v1/autentica/contrato`) — o mesmo token autoriza a API de **Pré-Postagem v1** (`/prepostagem/v1/prepostagens` + `/rotulo/assincrono/pdf`).
- Tabela `remessas` com cliente, transportadora, serviço, peso, volumes, código de rastreio, OV, NF e endereço derivado.
- UI já consolidada em `/logistica` (aba Remessas) + `RemessaForm` para edição.

A pré-postagem **substitui a etiqueta manual**: você cria o objeto na base dos Correios, recebe o **código de rastreio definitivo** + um **PDF de rótulo** pronto para colar no pacote e levar à agência (ou pedir coleta).

---

## Fluxo de negócio proposto

```text
Remessa criada (status=pendente)
        │
        │  [usuário clica "Gerar etiqueta Correios"]
        │  valida: serviço SEDEX/PAC, peso, dimensões, dest. com CEP, NF vinculada (opcional)
        ▼
POST  correios-api?action=prepostagem_criar   (edge function)
        │  → autentica (cache token 25min) → POST /prepostagem/v1/prepostagens
        │  ← devolve { id, codigoObjeto }
        ▼
Persiste em remessa_etiquetas (1 linha por tentativa)
        + atualiza remessas.codigo_rastreio, status='postado_pendente_pdf'
        ▼
POST  correios-api?action=prepostagem_rotulo   (mesma chamada ou job)
        │  → POST /prepostagem/v1/prepostagens/rotulo/assincrono/pdf
        │  ← devolve { idRecibo }
        ▼
GET   correios-api?action=prepostagem_pdf&idRecibo=...
        │  → polling até { dados: <base64 PDF> } (3-5 tentativas com backoff curto)
        │  → upload do PDF para Storage privado `dbavizee/etiquetas/<remessa_id>.pdf`
        ▼
remessa_etiquetas.pdf_path = <caminho>; status='emitida'
UI mostra botão "Baixar etiqueta (PDF)" e "Cancelar pré-postagem"
        ▼
[opcional] DELETE /prepostagem/v1/prepostagens/{id}  →  status='cancelada'
```

Estados de `remessa_etiquetas.status`: `pendente | emitida | erro | cancelada`.

---

## Onde implementar

### 1. Banco (1 migração)
Nova tabela `public.remessa_etiquetas`:
- `remessa_id` (FK), `id_correios`, `codigo_objeto`, `id_recibo_pdf`, `pdf_path`, `pdf_base64_size`, `payload_request` (jsonb), `payload_response` (jsonb), `status`, `erro_mensagem`, `created_by`, `empresa_id` (NOT NULL DEFAULT `current_empresa_id()`).
- Constraint `chk_remessa_etiquetas_status`.
- Trigger `set_empresa_id_default` (padrão multi-tenant Onda 1).
- RLS: SELECT/INSERT por `empresa_id` + papel `estoquista`/`admin`; DELETE só admin.
- Bucket privado `etiquetas-correios` em Storage (RLS por `empresa_id` no path).

### 2. Edge Function `correios-api` (extensão, sem nova função)
Adicionar 4 actions ao switch existente, reaproveitando `autenticarCorreios`:
- `prepostagem_criar` (POST) — monta corpo a partir da remessa + cliente + endereço + NF.
- `prepostagem_rotulo` (POST) — solicita geração assíncrona do PDF.
- `prepostagem_pdf` (GET) — consulta `idRecibo` e devolve base64.
- `prepostagem_cancelar` (DELETE) — cancela uma pré-postagem ainda não postada.

Todas exigem JWT do usuário (`requireAuth`) e checam papel `estoquista|admin` via service-role + `has_role`.

### 3. Serviço front-end
Novo `src/services/logistica/prepostagem.service.ts` com:
- `gerarEtiqueta(remessaId)` — orquestra as 3 chamadas + upload PDF para Storage + insere em `remessa_etiquetas`.
- `baixarEtiqueta(etiquetaId)` — gera signed URL do bucket.
- `cancelarEtiqueta(etiquetaId)`.

### 4. UI
- **`RemessaForm.tsx`** (rodapé do form, ao lado de Salvar): botão **"Gerar etiqueta Correios"** habilitado quando `tipo_remessa='entrega'`, serviço SEDEX/PAC, peso > 0, cliente com CEP. Usa `can('logistica','update')`.
- **`EntregaDrawer.tsx`** + tabela em `/logistica`: nova coluna **Etiqueta** com badge `pendente/emitida/erro` e ações `Baixar PDF` / `Regerar` / `Cancelar`.
- Toast com link direto para o PDF assim que o polling concluir.

### 5. Saúde do sistema
Adicionar card "Pré-postagem Correios" em `useSaudeSistema` chamando `correios-api?action=prepostagem_health` (lista últimas 24h: emitidas vs erros).

---

## Detalhes técnicos relevantes

- **Endpoints Correios** (produção):
  - Auth: `POST /token/v1/autentica/contrato` (já implementado).
  - Criar: `POST /prepostagem/v1/prepostagens` — body com remetente (do `app_configuracoes.empresa`), destinatário, serviço (03220 SEDEX / 03298 PAC contratual), dimensões, declaração de conteúdo (itens da NF se houver).
  - PDF assíncrono: `POST /prepostagem/v1/prepostagens/rotulo/assincrono/pdf` → `idRecibo`; depois `GET /prepostagem/v1/prepostagens/rotulo/download/assincrono/{idRecibo}` em polling (intervalo 1.5s, máx 6 tentativas; se ainda pendente, fica `pdf_path=null` e botão "Tentar baixar PDF" reaparece).
  - Cancelar: `DELETE /prepostagem/v1/prepostagens/{id}` (válido até a postagem física).
- **Cache de token**: introduzir cache em memória do isolate (TTL 25 min) — evita reautenticar a cada chamada e elimina a maior fonte de latência.
- **Idempotência**: `remessa_etiquetas` tem `UNIQUE (remessa_id, status='emitida')` parcial, impede duplicidade.
- **Erros tratados**: 401 (token expirado → reautentica e tenta 1x), 422 (campos inválidos → mensagem mostrada no toast), timeout (mantém status `pendente` e oferece reenvio).
- **Multi-tenant**: tudo respeita `current_empresa_id()` e o bucket usa path `<empresa_id>/<remessa_id>.pdf`.
- **Auditoria**: insere em `audit_log` (entidade `remessa_etiqueta`, ação `criar/cancelar`).
- **Configuração do remetente**: já existe `app_configuracoes.empresa` (CNPJ, IE, endereço completo) — basta consumir.

---

## Pré-requisitos a validar antes de codar

1. Confirmar com o usuário que o **contrato Correios já tem o módulo "Pré-Postagem" liberado** (visível no resp. da auth em `apis: [...]`; se faltar, é uma habilitação no portal CWS, não código).
2. Confirmar dimensões padrão (caixa) — proponho default `30×15×10 cm` (já usado na cotação) configurável em `app_configuracoes.logistica`.

---

## Ondas de entrega sugeridas

1. **Onda A (mínimo viável)**: tabela + 3 actions na edge + botão único no `RemessaForm` que faz o ciclo completo e devolve o PDF. ~1 iteração.
2. **Onda B**: cancelamento, regerar, coluna na lista de remessas, integração com `/logistica`.
3. **Onda C**: card de saúde + relatório "Etiquetas emitidas no mês" + impressão em lote (pega N remessas e devolve um PDF único — endpoint `/rotulo` aceita até 6 ids por chamada).

Aguardo aprovação para começar pela **Onda A**.
