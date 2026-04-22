interface SidebarBrandProps {
  collapsed: boolean;
  symbolSrc: string;
  logoSrc: string;
  marcaTexto: string;
  subtitulo: string;
}

/**
 * SidebarBrand
 *
 * Marca animada do sidebar. O símbolo permanece como âncora visual fixa,
 * enquanto a parte textual (logotipo + subtítulo) recolhe/expande junto
 * com a largura da sidebar, usando o mesmo timing (300ms,
 * cubic-bezier(0.22,1,0.36,1)).
 */
export function SidebarBrand({
  collapsed,
  symbolSrc,
  logoSrc,
  marcaTexto,
  subtitulo,
}: SidebarBrandProps) {
  return (
    <div className="flex min-w-0 items-center gap-2 overflow-hidden pl-1">
      {/* Âncora fixa — nunca desmonta */}
      <img
        src={symbolSrc}
        alt={marcaTexto || 'Marca'}
        className="h-8 w-8 shrink-0 object-contain"
      />

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
        <img
          src={logoSrc}
          alt={marcaTexto || 'Logotipo'}
          className="h-8 max-w-[140px] object-contain"
        />
        {subtitulo && (
          <span
            className={[
              'whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground',
              'transition-opacity duration-300',
              collapsed ? 'opacity-0 delay-0' : 'opacity-100 delay-150',
            ].join(' ')}
          >
            {subtitulo}
          </span>
        )}
      </div>
    </div>
  );
}
