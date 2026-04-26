import { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ApresentacaoTemplate } from '@/types/apresentacao';

interface TemplateDraft {
  nome: string;
  codigo: string;
  versao: string;
  descricao: string;
}

export function ApresentacaoTemplateManager({
  templates,
  isSaving,
  onCreate,
}: {
  templates: ApresentacaoTemplate[];
  isSaving: boolean;
  onCreate: (draft: TemplateDraft, file?: File) => Promise<void>;
}) {
  const [draft, setDraft] = useState<TemplateDraft>({ nome: '', codigo: '', versao: '1.0', descricao: '' });
  const [file, setFile] = useState<File | undefined>();

  return (
    <div className="rounded-md border p-4 space-y-3">
      <h3 className="font-semibold text-sm">Inclusão de templates</h3>
      <p className="text-xs text-muted-foreground">
        Cadastre novos templates versionados. Se um arquivo .pptx for enviado, ele será armazenado e vinculado ao template.
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        <div className="space-y-1"><Label>Nome</Label><Input value={draft.nome} onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))} /></div>
        <div className="space-y-1"><Label>Código</Label><Input value={draft.codigo} onChange={(e) => setDraft((d) => ({ ...d, codigo: e.target.value.toUpperCase().replace(/\s+/g, '_') }))} /></div>
        <div className="space-y-1"><Label>Versão</Label><Input value={draft.versao} onChange={(e) => setDraft((d) => ({ ...d, versao: e.target.value }))} /></div>
        <div className="space-y-1"><Label>Arquivo .pptx (opcional)</Label><Input type="file" accept=".pptx" onChange={(e) => setFile(e.target.files?.[0])} /></div>
      </div>
      <div className="space-y-1"><Label>Descrição</Label><Textarea value={draft.descricao} onChange={(e) => setDraft((d) => ({ ...d, descricao: e.target.value }))} /></div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">Templates ativos: {templates.length}</p>
        <Button
          className="h-11 w-full sm:h-10 sm:w-auto"
          onClick={() => onCreate(draft, file)}
          disabled={isSaving || !draft.nome || !draft.codigo || !draft.versao}
        >
          {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : <><Upload className="h-4 w-4 mr-2" />Incluir template</>}
        </Button>
      </div>
    </div>
  );
}
