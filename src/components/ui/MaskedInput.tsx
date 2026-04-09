import { Input } from "@/components/ui/input";
import { useCallback, useState } from "react";
import { validateCPF, validateCNPJ } from "@/lib/validators";
import { cn } from "@/lib/utils";

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  mask: "cpf" | "cnpj" | "cpf_cnpj" | "telefone" | "celular" | "cep";
  value: string;
  onChange: (value: string) => void;
  className?: string;
  showValidation?: boolean;
}

const masks: Record<string, (v: string) => string> = {
  cpf: (v) => v.replace(/\D/g, "").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2").slice(0, 14),
  cnpj: (v) => v.replace(/\D/g, "").replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1/$2").replace(/(\d{4})(\d{1,2})$/, "$1-$2").slice(0, 18),
  cpf_cnpj: (v) => {
    const digits = v.replace(/\D/g, "");
    if (digits.length <= 11) return masks.cpf(v);
    return masks.cnpj(v);
  },
  telefone: (v) => v.replace(/\D/g, "").replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2").slice(0, 14),
  celular: (v) => v.replace(/\D/g, "").replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2").slice(0, 15),
  cep: (v) => v.replace(/\D/g, "").replace(/(\d{5})(\d{1,3})$/, "$1-$2").slice(0, 9),
};

export function MaskedInput({ mask, value, onChange, className, showValidation = false, ...props }: MaskedInputProps) {
  const [touched, setTouched] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = masks[mask](e.target.value);
    onChange(masked);
  }, [mask, onChange]);

  const isValid = (() => {
    if (!showValidation || !touched || !value) return null;
    const digits = value.replace(/\D/g, "");
    if (mask === "cpf" && digits.length === 11) return validateCPF(digits);
    if (mask === "cnpj" && digits.length === 14) return validateCNPJ(digits);
    if (mask === "cpf_cnpj") {
      if (digits.length === 11) return validateCPF(digits);
      if (digits.length === 14) return validateCNPJ(digits);
    }
    return null;
  })();

  return (
    <div className="relative">
      <Input
        {...props}
        value={value}
        onChange={handleChange}
        onBlur={() => setTouched(true)}
        className={cn(
          "font-mono text-sm",
          isValid === false && "border-destructive focus-visible:ring-destructive",
          isValid === true && "border-success focus-visible:ring-success",
          className,
        )}
      />
      {isValid === false && (
        <p className="text-[10px] text-destructive mt-0.5">Documento inválido</p>
      )}
    </div>
  );
}
