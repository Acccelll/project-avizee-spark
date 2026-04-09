import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, CheckCircle2, FileText, ListChecks } from "lucide-react";

interface ErrosImportacaoPanelProps {
  data: any[];
  importType?: string;
}

export function ErrosImportacaoPanel({ data }: ErrosImportacaoPanelProps) {
  const total = data.length;
  const validos = data.filter(r => r._valid).length;
  const erros = total - validos;

  if (total === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Alert variant="default" className="bg-blue-50 border-blue-200">
          <FileText className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Total Lido</AlertTitle>
          <AlertDescription className="text-blue-700 font-bold text-lg">{total} registros</AlertDescription>
        </Alert>

        <Alert variant="default" className="bg-emerald-50 border-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-800">Válidos</AlertTitle>
          <AlertDescription className="text-emerald-700 font-bold text-lg">{validos} registros</AlertDescription>
        </Alert>

        <Alert variant="destructive" className="bg-rose-50 border-rose-200 text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600" />
          <AlertTitle className="text-rose-800">Com Erro</AlertTitle>
          <AlertDescription className="text-rose-700 font-bold text-lg">{erros} registros</AlertDescription>
        </Alert>
      </div>

      {erros > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção</AlertTitle>
          <AlertDescription>
            Existem {erros} registros com erros de validação. Eles serão ignorados na importação final.
            Corrija a planilha ou preencha os campos obrigatórios para incluí-los.
          </AlertDescription>
        </Alert>
      )}

      {validos > 0 && (
        <Alert variant="default" className="bg-emerald-50 border-emerald-200">
          <ListChecks className="h-4 w-4 text-emerald-600" />
          <AlertTitle className="text-emerald-800">Pronto para Carga</AlertTitle>
          <AlertDescription className="text-emerald-700">
            {validos} registros estão em conformidade e podem ser inseridos no banco.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
