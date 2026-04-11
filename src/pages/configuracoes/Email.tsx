// @ts-nocheck
import React, { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Loader2 } from 'lucide-react';
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
import { ConfigSection } from './components/ConfigSection';
import { TestConnectionButton } from './components/TestConnectionButton';
import { ApiKeyInput } from './components/ApiKeyInput';
import { useConfiguracoesEmail } from './hooks/useConfiguracoesEmail';
import { testarConexaoSMTP } from './services/configuracoes.service';

const emailSchema = z.object({
  smtp_host: z.string().min(1, 'Servidor SMTP é obrigatório'),
  smtp_porta: z.coerce.number().int().min(1).max(65535),
  smtp_usuario: z.string().email('E-mail inválido'),
  smtp_senha: z.string().min(1, 'Senha é obrigatória'),
  smtp_ssl: z.boolean(),
  remetente_nome: z.string().min(1, 'Nome do remetente é obrigatório'),
  remetente_email: z.string().email('E-mail inválido'),
});

type EmailFormData = z.infer<typeof emailSchema>;

export default function Email() {
  const { config, isLoading, handleSave, isSaving } = useConfiguracoesEmail();

  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: config,
  });

  useEffect(() => {
    if (config) {
      form.reset(config);
    }
  }, [config, form]);

  function onSubmit(data: EmailFormData) {
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
      title="Configurações de E-mail"
      description="Configure o servidor SMTP para envio de e-mails."
      icon={Mail}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="smtp_host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Servidor SMTP</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="smtp.example.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="smtp_porta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Porta</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" placeholder="587" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="smtp_usuario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuário SMTP</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="usuario@example.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="smtp_senha"
              render={({ field }) => (
                <FormItem>
                  <ApiKeyInput
                    label="Senha SMTP"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="••••••••"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="remetente_nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Remetente</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Avizee Spark" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="remetente_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail do Remetente</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="noreply@example.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="smtp_ssl"
            render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="!mt-0">Usar SSL/TLS</FormLabel>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center justify-between">
            <TestConnectionButton
              onTest={() => testarConexaoSMTP(form.getValues())}
              label="Testar SMTP"
            />
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </form>
      </Form>
    </ConfigSection>
  );
}
