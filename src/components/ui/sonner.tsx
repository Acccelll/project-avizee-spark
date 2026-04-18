import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Toaster global do sistema. Configurações padronizadas:
 *
 * - `position="bottom-right"`: menos intrusivo que top-right (não colide com topbar de 56px).
 * - `richColors`: success verde, error vermelho, warning amarelo, info azul (subtle).
 * - `closeButton`: usuário pode dispensar o toast manualmente.
 * - Duração diferenciada por severidade:
 *    - success/info: 4s
 *    - error: 6s (mais tempo para ler mensagens críticas)
 *    - warning: 5s
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-right"
      richColors
      closeButton
      containerAriaLabel="Notificações do sistema"
      className="toaster group"
      aria-live="polite"
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            "group toast group-[.toaster]:shadow-lg group-[.toaster]:border-border",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
