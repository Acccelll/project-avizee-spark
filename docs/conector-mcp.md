# Conector MCP do ERP AviZee (Claude)

Permite que um Claude (em qualquer conta) se conecte ao ERP como **conector** e trabalhe nas matérias do site: pesquisar pautas, salvar rascunhos, aprovar e publicar no site e postar no Instagram. Ele age **sempre como o usuário que autorizou**: o RLS e as permissões do ERP valem como no próprio sistema.

## Como funciona

```
Claude ──MCP──▶ Edge Function `mcp` ──(token do usuário)──▶ site_materias (RLS + trigger)
   │                   │
   │                   ├──(service_role, após checar conteudo:publicar)──▶ API do site / Instagram
   │
   └──OAuth 2.1──▶ Supabase Auth ──▶ tela /oauth/consent do ERP (usuário aprova)
```

- **Endereço do conector:** `https://mqqkngebblqiteydvxsz.supabase.co/functions/v1/mcp`
- **Descoberta:** `…/functions/v1/mcp/.well-known/oauth-protected-resource` aponta para o servidor OAuth do Supabase (`…/auth/v1`).
- **Consentimento:** `https://<domínio do ERP>/oauth/consent` (página `src/pages/OAuthConsent.tsx`).

## Ferramentas

| Ferramenta | Permissão | O que faz |
|---|---|---|
| `avizee_listar_categorias` | `conteudo:visualizar` | Categorias editoriais válidas do site |
| `avizee_listar_familias` | `conteudo:visualizar` | Famílias do catálogo, para `product_relation` |
| `avizee_buscar_materias` | `conteudo:visualizar` | Duplicidade de pauta (site + ERP) |
| `avizee_obter_materia` | `conteudo:visualizar` | Lê uma matéria |
| `avizee_salvar_materia` | `conteudo:criar` / `editar` | Cria ou atualiza um rascunho. Editar uma matéria aprovada desfaz a aprovação. |
| `avizee_publicar_materia` | `conteudo:publicar` | Registra a aprovação (com a frase do usuário) e publica no site |
| `avizee_publicar_instagram` | `conteudo:publicar` | Posta a legenda Título / Texto / Fonte com a imagem informada |

## Configuração (uma vez)

1. **Supabase → Authentication → OAuth Server**
   - Ativar o **OAuth 2.1 Server**.
   - **Authorization path:** `/oauth/consent`, com o **Site URL** do projeto apontando para o domínio do ERP (ex.: `https://sistema.avizee.com.br`).
   - Ativar **Dynamic client registration**. O claude.ai registra o conector sozinho. Revise periodicamente os clientes registrados.
2. **Supabase → Edge Functions → Secrets**
   - `SITE_BASE_URL`: URL pública do site (https).
   - `SITE_ERP_CONTENT_SECRET`: o mesmo valor de `ERP_CONTENT_SECRET` no site.
3. **Permissões no ERP** (Administração → Usuários): dar à pessoa de conteúdo `conteudo:visualizar`, `conteudo:criar`, `conteudo:editar` e `conteudo:publicar`. Administradores já têm todas.
4. **Instagram** (opcional): conectar a conta Business no módulo Social. A publicação exige o escopo `instagram_content_publish`, incluído no fluxo de conexão. Contas conectadas antes desta versão precisam reconectar. O app da Meta precisa desse escopo aprovado.

## Conectar no Claude (conta de criação)

1. claude.ai → **Configurações → Conectores → Adicionar conector personalizado**.
2. URL: `https://mqqkngebblqiteydvxsz.supabase.co/functions/v1/mcp`.
3. Ao conectar, o navegador abre o login do ERP e a tela "Autorizar acesso ao ERP". Clique em **Permitir**.
4. Envie a skill `avizee-materias` em **Configurações → Capacidades → Skills**.

Para **revogar** o acesso, remova o conector no Claude ou o cliente em Supabase → OAuth Server.

## Salvaguardas

- O token é do usuário. O conector não tem acesso próprio.
- Aprovar e publicar exigem `conteudo:publicar`, verificado no banco (trigger) e na função.
- A publicação exige `confirmacao_usuario`: a transcrição da mensagem de aprovação, registrada em `site_materias_eventos`.
- A reserva atômica impede publicação ou post duplicado.
- O token do Instagram fica no Vault, legível só pelas Edge Functions.
- Há limite de 60 chamadas por minuto por usuário.
