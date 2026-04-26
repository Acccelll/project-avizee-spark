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
        <Alert variant="default" className="bg-info/10 border-info/30">
          <FileText className="h-4 w-4 text-info" />
          <AlertTitle className="text-info">Total Lido</AlertTitle>
          <AlertDescription className="text-info font-bold text-lg">{total} registros</AlertDescription>
        </Alert>

        <Alert variant="default" className="bg-success/10 border-success/30">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertTitle className="text-success">Válidos</AlertTitle>
          <AlertDescription className="text-success font-bold text-lg">{validos} registros</AlertDescription>
        </Alert>

        <Alert variant="destructive" className="bg-destructive/10 border-destructive/30 text-destructive">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertTitle className="text-destructive">Com Erro</AlertTitle>
          <AlertDescription className="text-destructive font-bold text-lg">{erros} registros</AlertDescription>
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
        <Alert variant="default" className="bg-success/10 border-success/30">
          <ListChecks className="h-4 w-4 text-success" />
          <AlertTitle className="text-success">Pronto para Carga</AlertTitle>
          <AlertDescription className="text-success">
            {validos} registros estão em conformidade e podem ser inseridos no banco.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
