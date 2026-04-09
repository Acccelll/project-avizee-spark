import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileUp, FileCheck } from "lucide-react";

interface UploadPlanilhaCardProps {
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileName?: string;
  isProcessing?: boolean;
}

export function UploadPlanilhaCard({ onFileChange, fileName, isProcessing }: UploadPlanilhaCardProps) {
  return (
    <Card className="border-dashed border-2 hover:border-primary/50 transition-colors cursor-pointer relative">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          {fileName ? (
            <div className="p-3 bg-emerald-100 rounded-full">
              <FileCheck className="h-8 w-8 text-emerald-600" />
            </div>
          ) : (
            <div className="p-3 bg-primary/10 rounded-full">
              <FileUp className="h-8 w-8 text-primary" />
            </div>
          )}
        </div>
        <CardTitle>{fileName ? "Planilha Selecionada" : "Selecionar Planilha"}</CardTitle>
        <CardDescription>
          {fileName ? fileName : "Arraste ou clique para selecionar arquivo .xlsx ou .csv"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <Label htmlFor="file-upload" className="sr-only">Upload</Label>
        <Input
          id="file-upload"
          type="file"
          accept=".xlsx, .csv"
          className="hidden"
          onChange={onFileChange}
          disabled={isProcessing}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => document.getElementById('file-upload')?.click()}
          disabled={isProcessing}
        >
          {fileName ? "Trocar arquivo" : "Escolher arquivo"}
        </Button>
      </CardContent>
    </Card>
  );
}
