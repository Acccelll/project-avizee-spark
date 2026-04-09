import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeMap = {
  sm: "sm:max-w-md",
  md: "sm:max-w-xl",
  lg: "sm:max-w-3xl",
  xl: "sm:max-w-5xl",
};

export function FormModal({ open, onClose, title, children, size = "md" }: FormModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          // Desktop: centered modal with max-height
          sizeMap[size],
          "max-h-[90dvh] overflow-y-auto",
          // Mobile: full-screen sheet
          "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-0 max-sm:m-0 max-sm:max-h-none max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-x-0",
        )}
      >
        <DialogHeader className="sticky top-0 z-10 bg-background pb-2 pt-1">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            Formulário para {title}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
