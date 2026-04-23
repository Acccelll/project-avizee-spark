import { type ComponentType, type MouseEvent } from "react";
import { Phone, MessageCircle, Mail, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Botão de ação inline para cards mobile (touch target 36px).
 * Renderiza apenas se o `value` (telefone, email…) existir — caso contrário retorna null.
 */
interface MobileCardActionButtonProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  href?: string;
  onClick?: (e: MouseEvent) => void;
  variant?: "default" | "primary" | "success";
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: "text-muted-foreground hover:text-foreground hover:bg-muted",
  primary: "text-primary hover:bg-primary/10",
  success: "text-success hover:bg-success/10",
};

export function MobileCardActionButton({
  icon: Icon,
  label,
  href,
  onClick,
  variant = "default",
  className,
}: MobileCardActionButtonProps) {
  const baseCls = cn(
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors active:scale-95",
    variantStyles[variant],
    className,
  );

  const content = (
    <>
      <Icon className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={baseCls}
        onClick={(e) => e.stopPropagation()}
        aria-label={label}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={baseCls}
      aria-label={label}
    >
      {content}
    </button>
  );
}

/** Limpa caracteres não-numéricos para uso em tel:/wa.me */
function cleanPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 ? digits : null;
}

/** Constrói link wa.me com fallback para Brasil (+55) quando faltar DDI. */
function buildWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}`;
}

/**
 * Helper que monta o conjunto típico de ações de contato (📞 Wpp ✉ 👁) para cards de Cliente/Fornecedor.
 */
interface ContactInlineActionsProps {
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  onView?: () => void;
  /** Quando true, oculta o botão Visualizar (já existe ⋮ no canto). */
  hideView?: boolean;
}

export function ContactInlineActions({
  phone,
  whatsapp,
  email,
  onView,
  hideView = false,
}: ContactInlineActionsProps) {
  const tel = cleanPhone(phone);
  const wpp = cleanPhone(whatsapp ?? phone);
  const hasAny = tel || wpp || email || (!hideView && onView);
  if (!hasAny) return null;
  return (
    <>
      {tel && (
        <MobileCardActionButton
          icon={Phone}
          label={`Ligar para ${phone}`}
          href={`tel:${tel}`}
          variant="primary"
        />
      )}
      {wpp && (
        <MobileCardActionButton
          icon={MessageCircle}
          label="Abrir WhatsApp"
          href={buildWhatsAppUrl(wpp)}
          variant="success"
        />
      )}
      {email && (
        <MobileCardActionButton
          icon={Mail}
          label={`Enviar e-mail para ${email}`}
          href={`mailto:${email}`}
          variant="default"
        />
      )}
      {!hideView && onView && (
        <MobileCardActionButton
          icon={Eye}
          label="Visualizar"
          onClick={onView}
          variant="default"
          className="ml-auto"
        />
      )}
    </>
  );
}