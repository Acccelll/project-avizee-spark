import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ImportType, Mapping } from "@/hooks/importacao/types";

interface MapeamentoColunasFormProps {
  headers: string[];
  importType: ImportType;
  mapping: Mapping;
  onMappingChange: (field: string, col: string) => void;
}

export function MapeamentoColunasForm({ headers, importType, mapping, onMappingChange }: MapeamentoColunasFormProps) {
  const fieldsByImportType: Record<ImportType, { key: string; label: string; required?: boolean }[]> = {
    produtos: [
      { key: "codigo_interno", label: "Código Interno (SKU)", required: true },
      { key: "nome", label: "Nome/Descrição", required: true },
      { key: "preco_venda", label: "Preço de Venda", required: true },
      { key: "preco_custo", label: "Preço de Custo" },
      { key: "unidade_medida", label: "Unidade de Medida" },
      { key: "ncm", label: "NCM" },
      { key: "gtin", label: "GTIN/EAN" },
    ],
    clientes: [
      { key: "nome", label: "Nome/Razão Social", required: true },
      { key: "cpf_cnpj", label: "CPF/CNPJ", required: true },
      { key: "email", label: "E-mail" },
      { key: "telefone", label: "Telefone/Celular" },
      { key: "cidade", label: "Cidade" },
      { key: "uf", label: "Estado (UF)" },
    ],
    fornecedores: [
      { key: "nome", label: "Nome/Razão Social", required: true },
      { key: "cpf_cnpj", label: "CPF/CNPJ", required: true },
      { key: "email", label: "E-mail" },
      { key: "telefone", label: "Telefone/Celular" },
      { key: "cidade", label: "Cidade" },
      { key: "uf", label: "Estado (UF)" },
    ],
  };

  const fields = fieldsByImportType[importType];

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Campo do Sistema</TableHead>
            <TableHead>Coluna na Planilha</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field) => (
            <TableRow key={field.key}>
              <TableCell className="font-medium">
                {field.label} {field.required && <span className="text-rose-500">*</span>}
              </TableCell>
              <TableCell>
                <Select
                  value={mapping[field.key] || "ignorar"}
                  onValueChange={(val) => onMappingChange(field.key, val)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Ignorar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ignorar">Ignorar campo</SelectItem>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
