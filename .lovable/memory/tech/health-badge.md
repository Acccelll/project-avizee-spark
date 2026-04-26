---
name: HealthBadge
description: Componente para indicar saúde operacional de integrações externas (Sefaz, SMTP, Correios, AI Gateway), com 5 estados e tooltip opcional
type: design
---

# HealthBadge

Indicador visual padronizado para **saúde de integrações externas**. Não confundir com `StatusBadge` (status de domínio do ERP — pedido, NF, lançamento).

## Estados canônicos

| status     | cor          | uso                                            |
|------------|--------------|------------------------------------------------|
| `healthy`  | success      | Integração respondendo dentro do SLA           |
| `degraded` | warning      | Lentidão, falhas parciais, retry em curso      |
| `down`     | destructive  | Fora do ar / erro persistente                  |
| `unknown`  | muted        | Sem leitura recente / nunca verificado         |
| `checking` | info         | Verificação em andamento (ícone com `animate-spin`) |

## API

```tsx
<HealthBadge
  status="degraded"
  details="Latência média: 2.3s\nÚltima checagem: há 2min"
  compact={false}
/>
```

- `details` ativa tooltip; sem ele, apenas badge plana.
- `compact` esconde o texto, mantém ícone (uso em tabelas densas / sidebars).
- `aria-label` é montado automaticamente com `status + details`.

## Quando usar

- Painéis admin de Configurações / Integrações.
- Cards de Saúde do Sistema (`vw_admin_audit_unified`).
- Footers de páginas Fiscal/Financeiro mostrando status do proxy/SMTP.

## Quando NÃO usar

- Status de entidades de negócio (pedido, NF, baixa) → use `StatusBadge`.
- Estados de formulário (válido/inválido) → use mensagens inline.
