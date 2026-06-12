# Plano — GIF AviZee como símbolo de carregamento

## 1. Processar o GIF
- Copiar `user-uploads://Flat_logo_animation_rotating_gear_202606120954_1.gif` para `/tmp/`.
- Usar ImageMagick (`nix run nixpkgs#imagemagick`) para remover o fundo preto, preservando a animação:
  - `convert input.gif -coalesce -fuzz 8% -transparent black -layers Optimize /tmp/avizee-loader.gif`
- Subir como Lovable Asset (CDN) gerando `src/assets/avizee-loader.gif.asset.json` — evita binário no repositório.
- QA: abrir 1 frame para confirmar que o fundo ficou transparente e o engrenagem/letras seguem nítidos.

## 2. Novo componente `BrandLoader`
Criar `src/components/ui/BrandLoader.tsx`:
- Renderiza o GIF importado do asset pointer.
- Props: `size` (`sm` 32px / `md` 56px / `lg` 88px), `label`, `className`.
- Mantém `role="status"` + `aria-label` para acessibilidade (substituindo o `Spinner` visualmente, mas com semântica equivalente).
- Como já é animado, não aplica `animate-spin`. Respeita `prefers-reduced-motion` via classe `reduce-motion:opacity-90` (sem hack de pausar GIF, mas reduzindo destaque).

## 3. Integração nos pontos de carregamento
Trocar o `Spinner` pelo `BrandLoader` em:
- `src/components/ui/spinner.tsx` → `FullPageSpinner` e `ContentSpinner` (tela cheia + fallback do `LazyPage`).
- `src/components/auth/AuthLoadingScreen.tsx` → substitui o logo estático + `Spinner` por um único `BrandLoader` tamanho `lg` (o GIF já contém marca + movimento).

`Spinner` "inline" (usado dentro de botões/inputs) permanece como anel CSS — GIF não cabe nesses contextos.

## 4. Verificação
- Rodar a preview em `/` (rota lazy) para ver o `ContentSpinner` exibindo o GIF transparente sobre o fundo do app.
- Navegar enquanto auth carrega para validar `AuthLoadingScreen`.
- Conferir no DevTools que o asset vem via CDN e tem fundo transparente em tema claro **e** escuro.

## Detalhes técnicos
- Caminho do asset: `src/assets/avizee-loader.gif.asset.json` (importado como `import loaderAsset from "@/assets/avizee-loader.gif.asset.json"`).
- Tamanhos do `BrandLoader` aplicam apenas `height`; `width: auto` preserva a proporção do logotipo "AVIZEE + engrenagem".
- Sem mudanças em telas públicas (Login/Signup) — `AuthBrandingPanel` continua com o logo institucional estático.
