import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Loader2, Eye, History } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ConfigSection } from './components/ConfigSection';
import { TestConnectionButton } from './components/TestConnectionButton';
import { ApiKeyInput } from './components/ApiKeyInput';
import { ConfigHistoryDrawer } from './components/ConfigHistoryDrawer';
import { PreviewModal } from '@/components/ui/PreviewModal';
import { useConfiguracoesEmail } from './hooks/useConfiguracoesEmail';
import { testarConexaoSMTP } from './services/configuracoes.service';

const SAMPLE_VARS: Record<string, string> = {
  nome: 'Usuário Teste',
  email: 'usuario@exemplo.com',
  empresa: 'Avizee Spark',
  data: new Date().toLocaleDateString('pt-BR'),
  link: 'https://exemplo.com/link',
  codigo: 'ABC-12345',
  valor: 'R$ 1.250,00',
};

function renderTemplate(template: string): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => SAMPLE_VARS[key] ?? `{{${key}}}`);
}

const emailSchema = z.object({
  smtp_host: z.string().min(1, 'Servidor SMTP é obrigatório'),
  smtp_porta: z.coerce.number().int().min(1).max(65535),
  smtp_usuario: z.string().email('E-mail inválido'),
  smtp_senha: z.string().min(1, 'Senha é obrigatória'),
  smtp_ssl: z.boolean(),
  remetente_nome: z.string().min(1, 'Nome do remetente é obrigatório'),
  remetente_email: z.string().email('E-mail inválido'),
  template_assunto: z.string().optional(),
  template_corpo: z.string().optional(),
});

type EmailFormData = z.infer<typeof emailSchema>;

export default function Email() {
  const { config, isLoading, handleSave, isSaving } = useConfiguracoesEmail();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

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
    handleSave(data as any);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const previewAssunto = renderTemplate(form.watch('template_assunto') || 'Assunto do e-mail — {{empresa}}');
  const previewCorpo = renderTemplate(form.watch('template_corpo') || 'Olá, {{nome}}!\n\nObrigado por usar {{empresa}}.\n\nAtenciosamente,\n{{empresa}}');

  return (
    <div className="space-y-6">
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
              <div className="flex items-center gap-2">
                <TestConnectionButton
                  onTest={() => testarConexaoSMTP(form.getValues() as any)}
                  label="Testar SMTP"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHistoryOpen(true)}
                >
                  <History className="mr-2 h-4 w-4" />
                  Histórico
                </Button>
              </div>
              <Button type="submit" disabled={isSaving} aria-label="Salvar configurações de e-mail">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </form>
        </Form>
      </ConfigSection>

      <ConfigSection
        title="Template de E-mail"
        description="Personalize o modelo padrão de e-mails enviados pelo sistema. Use {{variavel}} para inserir valores dinâmicos."
        icon={Mail}
      >
        <Form {...form}>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="template_assunto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assunto Padrão</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ex: Confirmação de pedido — {{empresa}}"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="template_corpo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Corpo do E-mail</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={8}
                      placeholder={'Olá, {{nome}}!\n\nObrigado por usar {{empresa}}.\n\nAtenciosamente,\n{{empresa}}'}
                      className="font-mono text-sm"
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Variáveis disponíveis: {`{{nome}}`}, {`{{email}}`}, {`{{empresa}}`},{' '}
                    {`{{data}}`}, {`{{link}}`}, {`{{codigo}}`}, {`{{valor}}`}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Visualizar Preview
              </Button>
              <Button
                type="button"
                disabled={isSaving}
                aria-label="Salvar template de e-mail"
                onClick={form.handleSubmit(onSubmit)}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Template
              </Button>
            </div>
          </div>
        </Form>
      </ConfigSection>

      <ConfigHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        chave="email"
        onRestore={(valor) => {
          form.reset(valor as EmailFormData);
        }}
      />

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Preview do Template de E-mail"
      >
        <div className="space-y-4">
          <div className="rounded-lg border p-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Assunto
            </p>
            <p className="text-sm font-medium">{previewAssunto}</p>
          </div>
          <div className="rounded-lg border p-4 bg-background min-h-[200px]">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Corpo
            </p>
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
              {previewCorpo}
            </pre>
          </div>
          <p className="text-xs text-muted-foreground italic">
            Os valores mostrados são exemplos. As variáveis serão substituídas com dados reais no envio.
          </p>
        </div>
      </PreviewModal>
    </div>
  );
}
