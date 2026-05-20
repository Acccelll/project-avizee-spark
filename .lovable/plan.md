## Objetivo

Persistir o arquivo XML original de toda NF-e importada (entrada ou saída) para download posterior, sem perder a verdade fiscal.

## Recomendação: Storage interno (bucket `dbavizee`, prefixo `fiscal/`)

**Por que não Google Drive como destino principal:**
- Exige OAuth por usuário (cada operador autorizando sua conta) ou OAuth do dono — o que mistura responsabilidade fiscal com conta pessoal de um único Google.
- Latência maior, falhas de quota, risco de pasta movida/renomeada quebrando vínculo com a nota.
- Auditoria fiscal precisa que o arquivo viva ao lado do registro (mesma RLS, mesmo backup, mesmo `deleted_at`).
- Google Drive é ótimo como **espelho/exportação opcional**, não como fonte primária.

**Storage interno resolve sem dependências externas:**
- Bucket `dbavizee` já existe com prefixo `fiscal/` autorizado por policy.
- Coluna `notas_fiscais.caminho_xml text` já existe — hoje nunca é preenchida.
- Download direto via signed URL respeitando RLS de `faturamento_fiscal`.

## Escopo da implementação

### 1. Caminho canônico no bucket
```
fiscal/{ano}/{mes}/{tipo}/{chave_acesso}.xml
```
Ex.: `fiscal/2026/05/entrada/35260512345678000190550010000012341123456789.xml`. Idempotente (mesma chave → mesmo path, `upsert: true`).

### 2. Fluxos cobertos
| Fluxo | Onde inserir upload |
|---|---|
| Importação XML de **entrada** (drawer + Tradução) | `src/pages/Fiscal.tsx` → `aplicarImportacaoXml` / `handleXmlImport` |
| Importação XML em **lote (.zip)** de compras | `src/hooks/importacao/useImportacaoXml.ts` → `processImport` |
| **Saída** emitida pelo sistema (NF-e autorizada via SEFAZ) | já gera XML; salvar `xml_autorizado` no mesmo prefixo após retorno SEFAZ |
| **Saída** importada (XML colado/carregado) | mesmo handler do drawer fiscal |

Em todos os casos: `upload → set caminho_xml → insert/update nota`. Se o upload falhar, importação continua (a nota não pode ser perdida); registra warning em `importacao_logs`.

### 3. Service novo
`src/services/fiscal/xmlStorage.service.ts`:
- `uploadNfeXml({ chave, tipo, xmlText }) → { path }`
- `getNfeXmlSignedUrl(notaId) → string` (lê `caminho_xml`, gera signed URL 5 min)
- `downloadNfeXml(notaId) → Blob` (para botão "Baixar XML")

Encapsula `supabase.storage.from('dbavizee')` — respeita a regra de camada services única.

### 4. UI
- **Drawer/lista fiscal** (`Fiscal.tsx` + `FiscalDetail.tsx` + `NotaFiscalEditModal.tsx`): novo botão **"Baixar XML"** quando `caminho_xml` presente. Ícone `FileDown`, ao lado de "Baixar DANFE".
- **Coluna na tabela**: badge discreto "XML" indicando disponibilidade.
- **Importação lote**: relatório final mostra "X XMLs arquivados".

### 5. Backfill (opcional, fora deste plano)
NFs já importadas ficam sem `caminho_xml`. Pode ser feito sob demanda: ao abrir uma nota sem XML arquivado, oferecer "Reimportar XML para arquivar".

### 6. Migration
Apenas reforçar policy do bucket (já permite `fiscal/`) e criar índice parcial para consulta rápida:
```sql
CREATE INDEX IF NOT EXISTS idx_notas_fiscais_com_xml
  ON notas_fiscais (chave_acesso) WHERE caminho_xml IS NOT NULL;
```

### 7. Google Drive como **export opcional** (futuro, não nesta entrega)
Deixar gancho: botão "Enviar para Google Drive" no detalhe da nota, usando o connector `google_drive` já disponível. Faz upload pontual do XML baixado do Storage interno para uma pasta configurável em `app_configuracoes` (`fiscal.gdrive_folder_id`). Não substitui o Storage interno — apenas espelha.

## Arquivos afetados

- **Novo**: `src/services/fiscal/xmlStorage.service.ts`
- **Edit**: `src/pages/Fiscal.tsx` (handlers de import)
- **Edit**: `src/hooks/importacao/useImportacaoXml.ts` (lote .zip)
- **Edit**: `src/pages/fiscal/hooks/useNFeXmlImport.ts` (passar `xmlText` adiante)
- **Edit**: `src/pages/FiscalDetail.tsx` e `src/components/fiscal/NotaFiscalEditModal.tsx` (botão download)
- **Edit**: emissão SEFAZ (onde grava `xml_autorizado` no fluxo de saída) — localizar ponto exato durante implementação
- **Nova migration**: índice parcial
- **Memória**: atualizar `mem/features/faturamento-fiscal.md` com a doutrina "XML é arquivado em `dbavizee/fiscal/` por chave"

## Fora de escopo

- Sincronização automática contínua com Google Drive
- Backfill em massa de NFs antigas
- Compactação/criptografia adicional (Storage já é privado por RLS)
