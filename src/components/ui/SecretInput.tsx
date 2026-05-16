import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SecretInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

/**
 * Input para credenciais sensíveis (API keys, secrets, senhas) com toggle
 * de revelar/ocultar inline. Comportamento padrão: `type="password"`.
 */
export const SecretInput = forwardRef<HTMLInputElement, SecretInputProps>(
  ({ containerClassName, className, ...props }, ref) => {
    const [revealed, setRevealed] = useState(false);
    return (
      <div className={cn("relative", containerClassName)}>
        <Input
          ref={ref}
          type={revealed ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setRevealed((p) => !p)}
          tabIndex={-1}
          aria-label={revealed ? "Ocultar" : "Revelar"}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
SecretInput.displayName = "SecretInput";