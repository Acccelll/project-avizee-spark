import React, { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Settings } from 'lucide-react';
import { Loader2, Download, Upload } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfigSection } from './components/ConfigSection';
import { useConfiguracoesGeral } from './hooks/useConfiguracoesGeral';
import { fetchConfig, updateConfig } from './services/configuracoes.service';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const CONFIG_CHAVES = ['geral', 'email', 'integracoes', 'notificacoes', 'backup'] as const;

const geralSchema = z.object({
  nome_sistema: z.string().min(1, 'Nome do sistema é obrigatório'),
  moeda: z.string().min(1, 'Moeda é obrigatória'),
  fuso_horario: z.string().min(1, 'Fuso horário é obrigatório'),
  formato_data: z.string().min(1, 'Formato de data é obrigatório'),
  idioma: z.string().min(1, 'Idioma é obrigatório'),
  manutencao_modo: z.boolean(),
});

type GeralFormData = z.infer<typeof geralSchema>;

export default function Geral() {
  const { config, isLoading, handleSave, isSaving } = useConfiguracoesGeral();
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<Record<string, unknown> | null>(null);
  const [importFileName, setImportFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<GeralFormData>({
    resolver: zodResolver(geralSchema),
    defaultValues: config,
  });

  useEffect(() => {
    if (config) {
      form.reset(config);
    }
  }, [config, form]);

  function onSubmit(data: GeralFormData) {
    handleSave(data as Parameters<typeof handleSave>[0]);
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const results: Record<string, unknown> = {};
      await Promise.all(
        CONFIG_CHAVES.map(async (chave) => {
          try {
            results[chave] = await fetchConfig(chave);
          } catch {
            results[chave] = {};
          }
        })
      );

      const json = JSON.stringify({ versao: '1.0', exportado_em: new Date().toISOString(), configuracoes: results }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `configuracoes-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Configurações exportadas com sucesso.');
    } catch {
      toast.error('Erro ao exportar configurações.');
    } finally {
      setIsExporting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!parsed.configuracoes || typeof parsed.configuracoes !== 'object') {
          toast.error('Arquivo inválido: estrutura de configurações não encontrada.');
          return;
        }
        setImportData(parsed.configuracoes);
        setImportDialogOpen(true);
      } catch {
        toast.error('Arquivo inválido: não é um JSON válido.');
      }
    };
    reader.readAsText(file);
    // reset input so same file can be re-selected
    e.target.value = '';
  }

  async function handleImportConfirm() {
    if (!importData) return;
    setIsImporting(true);
    try {
      const chaves = Object.keys(importData).filter(
        (k) => CONFIG_CHAVES.includes(k as typeof CONFIG_CHAVES[number])
      ) as (typeof CONFIG_CHAVES[number])[];
      await Promise.all(
        chaves.map((chave) => updateConfig(chave, importData[chave] as Record<string, unknown>, user?.id))
      );
      toast.success('Configurações importadas com sucesso. Recarregue a página para ver as mudanças.');
      setImportDialogOpen(false);
    } catch {
      toast.error('Erro ao importar configurações.');
    } finally {
      setIsImporting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfigSection
        title="Configurações Gerais"
        description="Defina as configurações básicas do sistema."
        icon={Settings}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nome_sistema"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Sistema</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Avizee Spark" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="moeda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moeda</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a moeda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="BRL">BRL — Real Brasileiro</SelectItem>
                        <SelectItem value="USD">USD — Dólar Americano</SelectItem>
                        <SelectItem value="EUR">EUR — Euro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="idioma"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Idioma</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o idioma" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                        <SelectItem value="en-US">English (US)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fuso_horario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fuso Horário</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o fuso horário" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="America/Sao_Paulo">America/Sao_Paulo (BRT)</SelectItem>
                        <SelectItem value="America/Manaus">America/Manaus (AMT)</SelectItem>
                        <SelectItem value="America/Fortaleza">America/Fortaleza (BRT)</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="formato_data"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Formato de Data</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o formato" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="manutencao_modo"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Modo de Manutenção</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving} aria-label="Salvar configurações gerais">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </form>
        </Form>
      </ConfigSection>

      <ConfigSection
        title="Exportar / Importar Configurações"
        description="Faça backup de todas as configurações em JSON ou restaure a partir de um arquivo exportado anteriormente."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            aria-label="Exportar configurações como JSON"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Exportar JSON
          </Button>

          <Button
            type="button"
            variant="outline"
            aria-label="Importar configurações de arquivo JSON"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Importar JSON
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </ConfigSection>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Importação</DialogTitle>
            <DialogDescription>
              Arquivo: <strong>{importFileName}</strong>
              <br />
              Esta ação irá sobrescrever as configurações atuais de todos os grupos encontrados no arquivo. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(false)}
              disabled={isImporting}
            >
              Cancelar
            </Button>
            <Button onClick={handleImportConfirm} disabled={isImporting} aria-label="Confirmar importação de configurações">
              {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
