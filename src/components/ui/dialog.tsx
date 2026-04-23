import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Mobile (<sm): bottom-sheet — ancorado embaixo, full-width, cantos
        // arredondados no topo, slide vertical, suporta safe-area do iOS.
        "fixed inset-x-0 bottom-0 z-50 flex w-full max-h-[92svh] flex-col gap-0 overflow-hidden border bg-background p-0 shadow-xl duration-200",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        "rounded-t-2xl rounded-b-none pb-[max(env(safe-area-inset-bottom),0.5rem)]",
        // Desktop (>=sm): centralizado, max-width contido, rounded em todos os cantos.
        "sm:left-[50%] sm:top-[50%] sm:bottom-auto sm:inset-x-auto sm:max-w-lg sm:max-h-[85dvh] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:pb-0",
        "sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:zoom-out-[0.98] sm:data-[state=open]:zoom-in-[0.98]",
        className,
      )}
      {...props}
    >
      {/* Drag handle visual — só aparece em mobile, indica bottom-sheet */}
      <div
        aria-hidden="true"
        className="mx-auto mt-2 mb-1 h-1.5 w-12 shrink-0 rounded-full bg-muted sm:hidden"
      />
      {children}
      <DialogPrimitive.Close
        className="absolute right-3.5 top-3.5 rounded-sm opacity-60 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        aria-label="Fechar modal"
        title="Fechar modal"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Fechar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left shrink-0 px-6 pt-5 pb-4 pr-12 border-b",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex-1 overflow-y-auto px-6 py-5", className)} {...props} />
);
DialogBody.displayName = "DialogBody";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Mobile: sticky no fim do sheet, full-width, botões empilhados (CTA primário em cima).
      // Desktop: barra horizontal alinhada à direita.
      "flex flex-col-reverse gap-2 shrink-0 px-6 py-3.5 border-t bg-muted/30",
      "sm:flex-row sm:justify-end sm:gap-3",
      "[&>button]:max-sm:min-h-11 [&>button]:max-sm:w-full",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-[17px] font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground leading-relaxed", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
