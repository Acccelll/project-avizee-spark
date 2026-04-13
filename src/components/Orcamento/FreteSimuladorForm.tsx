/**
 * Subcomponente: campos de dimensões da embalagem e seleção de caixas.
 */
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, Box, Settings2 } from 'lucide-react';
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
  novaCaixa: { nome: string; altura: string; largura: string; comprimento: string };
  setNovaCaixa: (v: { nome: string; altura: string; largura: string; comprimento: string }) => void;
  salvandoCaixa: boolean;
  onSelecionarCaixa: (id: string) => void;
  onAdicionarCaixa: () => void;
  onRemoverCaixa: (id: string) => void;
}

export function FreteSimuladorForm({
  volumes, setVolumes, alturaCm, setAlturaCm, larguraCm, setLarguraCm,
  comprimentoCm, setComprimentoCm, caixas, gerenciarCaixasOpen, setGerenciarCaixasOpen,
  novaCaixa, setNovaCaixa, salvandoCaixa, onSelecionarCaixa, onAdicionarCaixa, onRemoverCaixa,
}: FreteSimuladorFormProps) {
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
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Box className="h-4 w-4" />
                  Caixas de Embalagem
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {caixas.length > 0 ? (
                  <div className="space-y-1.5">
                    {caixas.map((c) => (
                      <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium">{c.nome}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {c.altura_cm} × {c.largura_cm} × {c.comprimento_cm} cm
                          </span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onRemoverCaixa(c.id)} title="Remover caixa">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhuma caixa cadastrada.</p>
                )}
                <Separator />
                <div>
                  <p className="text-xs font-medium mb-2">Nova caixa</p>
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
                  </div>
                  <Button size="sm" onClick={onAdicionarCaixa} disabled={salvandoCaixa} className="mt-3 gap-1.5">
                    {salvandoCaixa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Adicionar caixa
                  </Button>
                </div>
              </div>
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
