/**
 * Tipagem e helpers comuns a todos os overlays do sistema.
 *
 * Padroniza o handler `onOpenChange` de Radix (Dialog/Sheet/AlertDialog/Popover),
 * que recebe um boolean. Em vez de `onOpenChange={onClose}` (que ignora o valor
 * e funciona "por sorte"), todo overlay deve usar `closeOnly(handler)` para
 * disparar o callback APENAS quando o estado novo for `false` (fechando).
 */

export type OverlayProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Adapta um handler `() => void` para a assinatura `(open: boolean) => void`
 * de Radix, disparando-o apenas quando o overlay estiver fechando.
 *
 * Permite passar um guard opcional (`when`) para bloquear o fechamento
 * (ex: durante loading ou quando o form está dirty).
 */
export const closeOnly =
  (onClose: () => void, when: () => boolean = () => true) =>
  (open: boolean) => {
    if (!open && when()) onClose();
  };
