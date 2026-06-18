import type { MultiSelectOption } from "@/components/ui/MultiSelect";
import {
  fiscalInternalStatusOptions,
  fiscalSefazStatusOptions,
  getFiscalInternalStatus,
  getFiscalSefazStatus,
} from "@/lib/fiscalStatus";

export const modeloLabels: Record<string, string> = {
  "55": "NF-e",
  "65": "NFC-e",
  "57": "CT-e",
  "67": "CT-e OS",
  nfse: "NFS-e",
  outro: "Outro",
};

export const origemLabels: Record<string, string> = {
  manual: "Manual",
  pedido: "Pedido",
  xml_importado: "Importação XML",
};

export const tipoOptions: MultiSelectOption[] = [
  { label: "Entrada", value: "entrada" },
  { label: "Saída", value: "saida" },
];

export const modeloOptions: MultiSelectOption[] = Object.entries(modeloLabels).map(
  ([value, label]) => ({ label, value }),
);

export const origemOptions: MultiSelectOption[] = Object.entries(origemLabels).map(
  ([value, label]) => ({ label, value }),
);

export const statusOptions: MultiSelectOption[] = fiscalInternalStatusOptions.map((value) => ({
  value,
  label: getFiscalInternalStatus(value).label,
}));

export const statusSefazOptions: MultiSelectOption[] = fiscalSefazStatusOptions.map((value) => ({
  value,
  label: getFiscalSefazStatus(value).label,
}));

export interface FiscalTipoConfig {
  title: string;
  subtitle: string;
  addLabel: string;
  moduleKey: string;
  parceiroLabel: string;
}

export function getFiscalTipoConfig(tipoParam: string | null): FiscalTipoConfig {
  if (tipoParam === "entrada") {
    return {
      title: "Notas de Entrada",
      subtitle: "Central de conferência e recebimento fiscal",
      addLabel: "Nova NF de Entrada",
      moduleKey: "notas-entrada",
      parceiroLabel: "Fornecedor",
    };
  }
  if (tipoParam === "saida") {
    return {
      title: "Notas de Saída",
      subtitle: "Notas fiscais de saída e faturamento",
      addLabel: "Nova NF de Saída",
      moduleKey: "notas-saida",
      parceiroLabel: "Cliente",
    };
  }
  return {
    title: "Fiscal",
    subtitle: "Notas fiscais, faturas e documentos",
    addLabel: "Nova NF",
    moduleKey: "notas-fiscais",
    parceiroLabel: "Parceiro",
  };
}