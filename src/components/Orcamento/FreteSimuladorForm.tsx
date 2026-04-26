/**
 * Subcomponente: campos de dimensões da embalagem e seleção de caixas.
 */
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Trash2, Box, Settings2, Pencil, X, Check } from 'lucide-react';
import { useState } from 'react';
import type { CaixaEmbalagem } from '@/services/freteSimulacao.service';

interface FreteSimuladorFormProps {
  volumes: number;
  setVolumes: (v: number) => void;
  alturaCm: number;
  setAlturaCm: (v: number) => void;
  larguraCm: number;
  setLarguraCm: (v: number) => void;
  comprimentoCm: number;
  setComprimentoCm: (v: number) => void;
  caixas: CaixaEmbalagem[];
  gerenciarCaixasOpen: boolean;
  setGerenciarCaixasOpen: (v: boolean) => void;
  novaCaixa: { nome: string; altura: string; largura: string; comprimento: string; peso: string };
  setNovaCaixa: (v: { nome: string; altura: string; largura: string; comprimento: string; peso: string }) => void;
  salvandoCaixa: boolean;
  editandoCaixaId: string | null;
  onSelecionarCaixa: (id: string) => void;
  onAdicionarCaixa: () => void;
  onRemoverCaixa: (id: string) => void;
  onEditarCaixa: (id: string) => void;
  onCancelarEdicaoCaixa: () => void;
}

export function FreteSimuladorForm({
  volumes, setVolumes, alturaCm, setAlturaCm, larguraCm, setLarguraCm,
  comprimentoCm, setComprimentoCm, caixas, gerenciarCaixasOpen, setGerenciarCaixasOpen,
  novaCaixa, setNovaCaixa, salvandoCaixa, editandoCaixaId,
  onSelecionarCaixa, onAdicionarCaixa, onRemoverCaixa, onEditarCaixa, onCancelarEdicaoCaixa,
}: FreteSimuladorFormProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const caixaPendenteExclusao = caixas.find((c) => c.id === confirmDeleteId);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">Dimensões da embalagem</p>
        <div className="flex items-center gap-1.5">
          {caixas.length > 0 && (
            <Select onValueChange={onSelecionarCaixa}>
              <SelectTrigger className="h-7 text-xs w-[160px]">
                <Box className="h-3 w-3 mr-1 shrink-0" />
                <SelectValue placeholder="Selecionar caixa..." />
              </SelectTrigger>
              <SelectContent>
                {caixas.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.nome} ({c.altura_cm}×{c.largura_cm}×{c.comprimento_cm} cm)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Dialog open={gerenciarCaixasOpen} onOpenChange={setGerenciarCaixasOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 gap-1 text-xs">
                <Settings2 className="h-3 w-3" />
                {caixas.length === 0 ? 'Cadastrar caixas' : 'Gerenciar'}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md h-[85vh] sm:h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
              <DialogHeader className="shrink-0 border-b px-6 py-4">
                <DialogTitle className="flex items-center gap-2">
                  <Box className="h-4 w-4" />
                  Caixas de Embalagem
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 min-h-0">
                <div className="px-6 py-3">
                  {caixas.length > 0 ? (
                    <div className="space-y-1.5">
                      {caixas.map((c) => {
                        const ativo = editandoCaixaId === c.id;
                        return (
                          <div
                            key={c.id}
                            className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm gap-2 transition-colors ${ativo ? 'border-primary bg-primary/5' : 'hover:bg-accent/40 cursor-pointer'}`}
                            onClick={() => !ativo && onEditarCaixa(c.id)}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">{c.nome}</div>
                              <div className="text-xs text-muted-foreground">
                                {c.altura_cm} × {c.largura_cm} × {c.comprimento_cm} cm
                                {c.peso_kg ? ` · ${c.peso_kg.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kg` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={(e) => { e.stopPropagation(); onEditarCaixa(c.id); }}
                                title="Editar caixa"
                                aria-label="Editar caixa"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(c.id); }}
                                title="Remover caixa"
                                aria-label="Remover caixa"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma caixa cadastrada.</p>
                  )}
                </div>
              </ScrollArea>
              <div className="shrink-0 border-t px-6 py-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium">{editandoCaixaId ? 'Editar caixa' : 'Nova caixa'}</p>
                    {editandoCaixaId && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={onCancelarEdicaoCaixa}>
                        <X className="h-3 w-3" /> Cancelar
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2 space-y-1">
                      <Label className="text-xs">Nome / Identificação*</Label>
                      <Input placeholder="Ex.: Caixa Pequena" value={novaCaixa.nome} onChange={(e) => setNovaCaixa({ ...novaCaixa, nome: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Altura (cm)*</Label>
                      <Input type="number" min={0} placeholder="0" value={novaCaixa.altura} onChange={(e) => setNovaCaixa({ ...novaCaixa, altura: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Largura (cm)*</Label>
                      <Input type="number" min={0} placeholder="0" value={novaCaixa.largura} onChange={(e) => setNovaCaixa({ ...novaCaixa, largura: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Comprimento (cm)*</Label>
                      <Input type="number" min={0} placeholder="0" value={novaCaixa.comprimento} onChange={(e) => setNovaCaixa({ ...novaCaixa, comprimento: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Peso (kg)</Label>
                      <Input type="number" min={0} step="0.001" placeholder="0,000" value={novaCaixa.peso} onChange={(e) => setNovaCaixa({ ...novaCaixa, peso: e.target.value })} className="h-8 text-sm" />
                    </div>
                  </div>
                  <Button size="sm" onClick={onAdicionarCaixa} disabled={salvandoCaixa} className="mt-3 gap-1.5 w-full sm:w-auto">
                    {salvandoCaixa
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : editandoCaixaId
                        ? <Check className="h-3.5 w-3.5" />
                        : <Plus className="h-3.5 w-3.5" />}
                    {editandoCaixaId ? 'Salvar alterações' : 'Adicionar caixa'}
                  </Button>
              </div>
              <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover caixa</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja remover a caixa <strong>{caixaPendenteExclusao?.nome}</strong>? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => {
                        if (confirmDeleteId) onRemoverCaixa(confirmDeleteId);
                        setConfirmDeleteId(null);
                      }}
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Volumes</Label>
          <Input type="number" min={1} value={volumes} onChange={(e) => setVolumes(Math.max(1, Number(e.target.value)))} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Altura (cm)</Label>
          <Input type="number" min={0} value={alturaCm} onChange={(e) => setAlturaCm(Number(e.target.value))} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Largura (cm)</Label>
          <Input type="number" min={0} value={larguraCm} onChange={(e) => setLarguraCm(Number(e.target.value))} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Comprimento (cm)</Label>
          <Input type="number" min={0} value={comprimentoCm} onChange={(e) => setComprimentoCm(Number(e.target.value))} className="h-8 text-sm" />
        </div>
      </div>
    </div>
  );
}
