/**
 * `PasswordStrengthIndicator` — componente único para visualizar força e
 * critérios de senha. Substitui implementações duplicadas em Signup/Reset/
 * Configurações, garantindo consistência visual e semântica.
 *
 * Usa apenas tokens semânticos do design system (destructive/warning/success).
 */

import { Check, X } from "lucide-react";
import {
  getPasswordCriteriaWithMatch,
  getPasswordStrength,
  type PasswordCriterion,
} from "@/lib/passwordPolicy";

export interface PasswordStrengthIndicatorProps {
  password: string;
  /** Confirmação opcional — quando fornecida, exibe o critério "confirmação confere". */
  confirm?: string;
  /** Esconde o checklist de critérios (mantém só a barra). */
  hideCriteria?: boolean;
  className?: string;
}

export function PasswordStrengthIndicator({
  password,
  confirm,
  hideCriteria = false,
  className = "",
}: PasswordStrengthIndicatorProps) {
  if (!password) return null;

  const strength = getPasswordStrength(password);
  const criteria: PasswordCriterion[] = confirm !== undefined
    ? getPasswordCriteriaWithMatch(password, confirm)
    : getPasswordCriteriaWithMatch(password, password); // ignora match se sem confirm
  const visibleCriteria = confirm !== undefined ? criteria : criteria.filter((c) => c.key !== "match");

  return (
    <div className={`space-y-2 mt-1 ${className}`} role="status" aria-live="polite">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full transition-colors ${
              level <= strength.level ? strength.bar : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Força: <span className="font-medium text-foreground">{strength.label || "—"}</span>
      </p>
      {!hideCriteria && (
        <ul className="space-y-1 text-[11px]">
          {visibleCriteria.map((c) => (
            <li
              key={c.key}
              className={`flex items-center gap-1.5 ${
                c.met ? "text-success" : "text-muted-foreground"
              }`}
            >
              {c.met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
              {c.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}