import React, { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bell, Loader2 } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfigSection } from './components/ConfigSection';
import { useConfiguracoesNotificacoes } from './hooks/useConfiguracoesNotificacoes';

const notificacoesSchema = z.object({
  email_novo_pedido: z.boolean(),
  email_pagamento_recebido: z.boolean(),
  email_estoque_baixo: z.boolean(),
  push_ativo: z.boolean(),
  frequencia_resumo: z.enum(['diario', 'semanal', 'nunca']),
});

type NotificacoesFormData = z.infer<typeof notificacoesSchema>;

export default function Notificacoes() {
  const { config, isLoading, handleSave, isSaving } = useConfiguracoesNotificacoes();

  const form = useForm<NotificacoesFormData>({
    resolver: zodResolver(notificacoesSchema),
    defaultValues: config,
  });

  useEffect(() => {
    if (config) {
      form.reset(config);
    }
  }, [config, form]);

  function onSubmit(data: NotificacoesFormData) {
    handleSave(data);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ConfigSection
      title="Configurações de Notificações"
      description="Gerencie como e quando você recebe notificações."
      icon={Bell}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm font-medium">Notificações por E-mail</p>

            <FormField
              control={form.control}
              name="email_novo_pedido"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Novo pedido recebido</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email_pagamento_recebido"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Pagamento recebido</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email_estoque_baixo"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Estoque baixo</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <p className="text-sm font-medium">Notificações Push</p>

            <FormField
              control={form.control}
              name="push_ativo"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">Ativar notificações push</FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="frequencia_resumo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Frequência do Resumo</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a frequência" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="diario">Diário</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="nunca">Nunca</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving} aria-label="Salvar configurações de notificações">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </form>
      </Form>
    </ConfigSection>
  );
}
