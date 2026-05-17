import { useBranding } from "@/hooks/useBranding";
import { BarChart3, FileText, Wallet, Package } from "lucide-react";

const FEATURES = [
  { Icon: BarChart3, text: "Dashboard de desempenho em tempo real" },
  { Icon: FileText, text: "Emissão de NF-e e NFS-e integrada" },
  { Icon: Wallet, text: "Financeiro e fluxo de caixa unificado" },
  { Icon: Package, text: "Gestão de estoque e logística" },
];

/**
 * Painel lateral de branding usado em telas auth (Login/Signup) acima de `lg:`.
 * Some no mobile/tablet para manter o card centralizado.
 */
export function AuthBrandingPanel() {
  const branding = useBranding();
  return (
    <aside className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary/10 via-primary/5 to-background border-r border-border/50 p-12 w-[460px] xl:w-[520px]">
      <div className="flex items-center gap-3">
        <img
          src={branding.logoUrl}
          alt={branding.marcaTexto || "ERP"}
          className="h-12 object-contain drop-shadow-sm"
        />
      </div>
      <div className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            {branding.marcaTexto || "Sistema ERP"}
          </h2>
          {branding.marcaSubtitulo && (
            <p className="text-base text-muted-foreground">{branding.marcaSubtitulo}</p>
          )}
        </div>
        <ul className="space-y-4">
          {FEATURES.map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-foreground/85">
              <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                <Icon className="h-4 w-4" />
              </span>
              <span className="leading-snug pt-1.5">{text}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground/70 select-none">
        © {new Date().getFullYear()} AviZee ERP — Todos os direitos reservados
      </p>
    </aside>
  );
}