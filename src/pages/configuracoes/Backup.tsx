import React, { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Database, Loader2, CheckCircle2, XCircle, Clock, Archive } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfigSection } from './components/ConfigSection';
import { useConfiguracoesBackup } from './hooks/useConfiguracoesBackup';

const backupSchema = z.object({
  frequencia: z.enum(['diario', 'semanal', 'mensal']),
  horario: z.string().min(1, 'Horário é obrigatório'),
  retencao_dias: z.coerce.number().int().min(1).max(365),
  incluir_arquivos: z.boolean(),
  destino: z.enum(['local', 'cloud']),
});

type BackupFormData = z.infer<typeof backupSchema>;

const frequenciaLabel: Record<string, string> = {
  diario: 'Diário',
  semanal: 'Semanal',
  mensal: 'Mensal',
};

export default function Backup() {
  const { config, isLoading, handleSave, isSaving } = useConfiguracoesBackup();

  const form = useForm<BackupFormData>({
    resolver: zodResolver(backupSchema),
    defaultValues: config,
  });

  useEffect(() => {
    if (config) {
      form.reset(config);
    }
  }, [config, form]);

  function onSubmit(data: BackupFormData) {
    handleSave(data as any);
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
        title="Status do Backup Automático"
        description="Informações sobre o estado atual dos backups automáticos."
        icon={Archive}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            {config.frequencia ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="text-xs text-muted-foreground">
                {config.frequencia ? 'Ativo' : 'Inativo'}
              </p>
            </div>
            <Badge
              variant={config.frequencia ? 'default' : 'secondary'}
              className="ml-auto"
            >
              {config.frequencia ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Frequência</p>
              <p className="text-xs text-muted-foreground">
                {config.frequencia
                  ? `${frequenciaLabel[config.frequencia]} às ${config.horario || '—'}`
                  : '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Database className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Backups Retidos</p>
              <p className="text-xs text-muted-foreground">
                Últimos {config.retencao_dias} dia(s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Último Backup Automático</p>
              <p className="text-xs text-muted-foreground italic">
                Funcionalidade disponível em breve
              </p>
            </div>
          </div>
        </div>
      </ConfigSection>

      <ConfigSection
        title="Configurações de Backup"
        description="Configure a frequência e o destino dos backups automáticos."
        icon={Database}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="frequencia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequência</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a frequência" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="diario">Diário</SelectItem>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="mensal">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="horario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário</FormLabel>
                    <FormControl>
                      <Input {...field} type="time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="retencao_dias"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Retenção (dias)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min={1} max={365} placeholder="30" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="destino"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destino</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o destino" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cloud">Nuvem</SelectItem>
                        <SelectItem value="local">Local</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="incluir_arquivos"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Incluir arquivos no backup</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving} aria-label="Salvar configurações de backup">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </form>
        </Form>
      </ConfigSection>
    </div>
  );
}
