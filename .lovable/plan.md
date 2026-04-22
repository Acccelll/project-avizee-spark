

# Transição refinada da marca no AppSidebar

## Objetivo

Substituir a renderização binária da marca (`collapsed ? símbolo : logo completa`) por uma estrutura única e estável, onde o **símbolo é âncora fixa** e a **parte textual + subtítulo** recolhem/expandem junto com a sidebar, sincronizados ao mesmo timing da largura (`duration-300`, `cubic-bezier(0.22,1,0.36,1)`).

## Mudanças

### 1) Novo componente `src/components/sidebar/SidebarBrand.tsx`

Componente isolado e reutilizável, sempre com a mesma estrutura DOM em ambos os estados.

**Props:**
```ts
interface SidebarBrandProps {
  collapsed: boolean;
  symbolSrc: string;
  logoSrc: string;
  marcaTexto: string;
  subtitulo: string;
}
```

**Estrutura:**
```tsx
<div className="flex items-center gap-2 pl-1 min-w-0">
  {/* Âncora fixa — nunca desmonta */}
  <img src={symbolSrc} alt={marcaTexto || 'Marca'} 
       className="h-8 w-8 shrink-0 object-contain" />

  {/* Container textual animado */}
  <div
    aria-hidden={collapsed}
    className={[
      'flex items-center gap-2 overflow-hidden',
      'transition-[max-width,opacity,transform] duration-300',
      'ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[max-width,opacity]',
      collapsed
        ? 'max-w-0 opacity-0 -translate-x-1'
        : 'max-w-[180px] opacity-100 translate-x-0',
    ].join(' ')}
  >
    <img src={logoSrc} alt={marcaTexto || 'Logotipo'} 
         className="h-8 max-w-[140px] object-contain" />
    {subtitulo && (
      <span
        className={[
          'text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground whitespace-nowrap',
          'transition-opacity duration-300',
          collapsed ? 'opacity-0 delay-0' : 'opacity-100 delay-150',
        ].join(' ')}
      >
        {subtitulo}
      </span>
    )}
  </div>
</div>
```

**Estratégias de animação:**
- `max-width` (0 → 180px): cria a sensação de retração horizontal coerente com a largura da sidebar.
- `opacity` (0 → 1): suaviza a aparição/desaparição.
- `translate-x` (-1 → 0): leve deslocamento que reforça a sensação de "abrir para a direita".
- `overflow-hidden`: garante o recolhimento limpo sem vazar conteúdo.
- `delay-150` no subtítulo (somente ao expandir): entrada escalonada e sutil.
- `aria-hidden={collapsed}`: acessibilidade — leitores de tela ignoram o conteúdo recolhido.

### 2) Refatorar `src/components/AppSidebar.tsx`

No bloco do header (linhas ~73-110), substituir o `if/else` binário por:

```tsx
<div className="flex h-14 items-center justify-between border-b border-border/60 px-2">
  <SidebarBrand
    collapsed={collapsed}
    symbolSrc={symbolSrc}
    logoSrc={logoSrc}
    marcaTexto={branding.marcaTexto || ''}
    subtitulo={subtitulo}
  />
  <Button
    variant="ghost"
    size="icon"
    className="hidden h-7 w-7 shrink-0 md:inline-flex"
    onClick={onToggleCollapsed}
    aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
    title={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
  >
    <ChevronRight 
      className={`h-3.5 w-3.5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${collapsed ? '' : 'rotate-180'}`} 
    />
  </Button>
</div>
```

Remover imports não mais usados diretamente no `AppSidebar` se aplicável (`brandLogotipo`/`brandSimbolo` continuam necessários como fallback passados via props).

## Critérios de aceite atendidos

- ✅ Símbolo permanece ancorado (mesma instância DOM, sem desmontar).
- ✅ Texto e subtítulo recolhem horizontalmente via `max-width` + `opacity` + `translate-x`.
- ✅ Subtítulo entra com leve atraso (`delay-150`) ao expandir, sai imediato ao recolher.
- ✅ Mesma duração (300ms) e mesmo easing da largura da sidebar.
- ✅ Sem troca de markup, sem flicker, sem teleporte.
- ✅ `alt`, `aria-label`, `aria-hidden` preservados.
- ✅ Sem reflow brusco — `shrink-0` no símbolo e no botão garantem âncoras estáveis.
- ✅ Performance: apenas propriedades animáveis baratas (opacity, transform, max-width); `will-change` aplicado.

## Arquivos afetados

- **Novo:** `src/components/sidebar/SidebarBrand.tsx`
- **Editado:** `src/components/AppSidebar.tsx` (substitui o bloco brand do header)

