---
name: A11y & Mobile — Checklist canônico
description: Regras para touch targets, aria-label em ícones-botão, breadcrumbs e confirmação destrutiva
type: preference
---

## Touch targets (44×44 mínimo no mobile)

Padrão mobile-safe aceito pelo linter (`scripts/lint-touch-targets.mjs`):

```tsx
// botão único usado em ambos
<Button size="icon" className="min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 sm:h-9 sm:w-9" />

// ou versões separadas
<Button className="hidden sm:inline-flex h-9 ..." />   {/* desktop */}
<Button className="sm:hidden min-h-11 min-w-11 ..." /> {/* mobile */}
```

Linter aceita também `min-h-[44px]`. Novos ícones-botão em telas mobile
devem seguir esse padrão; revisar antes de promover o CI a bloqueante.

## Icon-only Button precisa de nome acessível

Toda `<Button size="icon">` ou `<Button>` que só renderiza um `<Icon/>`
precisa de **um** dos seguintes:
- `aria-label="…"` no próprio Button (ou no `<Link>` interno quando `asChild`),
- `<span className="sr-only">…</span>` como filho,
- `aria-hidden="true"` apenas quando o ícone é puramente decorativo e
  já existe um label visível ao lado.

Auditoria rápida (deve dar 0):

```bash
python3 -c "import re,glob;
for f in glob.glob('src/**/*.tsx', recursive=True):
    L=open(f).readlines()
    for i,l in enumerate(L):
        if 'size=\"icon\"' not in l: continue
        s=i
        while s>0 and '<Button' not in L[s]: s-=1
        e=s; d=0
        while e<len(L):
            for c in L[e]:
                if c=='{': d+=1
                elif c=='}': d-=1
                elif c=='>' and d==0: break
            else: e+=1; continue
            break
        b=''.join(L[s:e+1])
        if any(t in b for t in ['aria-label','aria-hidden','title=','sr-only']): continue
        nx=L[e+1] if e+1<len(L) else ''
        if re.search(r'>\\s*[A-Za-z0-9]',nx): continue
        print(f'{f}:{s+1}')"
```

## Confirmação destrutiva

Excluir/cancelar SEMPRE via `AlertDialog` (helper canônico
`useConfirmDialog`). Nunca ação imediata.

## Feedback

Sucesso/erro de mutations sempre via `toast` (`sonner`). Não usar
`alert()` nem mensagens silenciosas.