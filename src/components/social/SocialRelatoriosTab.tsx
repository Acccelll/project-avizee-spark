import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download } from 'lucide-react';

interface Props {
  canExportReports: boolean;
  onExportCsv: () => void;
  onExportXlsx: () => void;
  permissions: readonly string[];
}

export function SocialRelatoriosTab({ canExportReports, onExportCsv, onExportXlsx, permissions }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Relatórios sociais</CardTitle>
        <CardDescription>Consolidado por rede, ranking de posts e comparativos por período.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={onExportCsv} disabled={!canExportReports}>
            <Download className="h-4 w-4 mr-2" />
            Exportar consolidado CSV
          </Button>
          <Button variant="outline" onClick={onExportXlsx} disabled={!canExportReports}>
            <Download className="h-4 w-4 mr-2" />
            Exportar consolidado XLSX
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">PDF permanece preparado para evolução futura, sem promessa funcional nesta etapa.</p>

        <div className="rounded-md border p-3 text-sm">
          <p className="font-medium mb-2">Permissões aplicadas</p>
          <div className="flex gap-2 flex-wrap">
            {permissions.map((perm) => <Badge key={perm} variant="outline">{perm}</Badge>)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
