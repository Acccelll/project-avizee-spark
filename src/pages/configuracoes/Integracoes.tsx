import React, { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Loader2, Webhook } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfigSection } from './components/ConfigSection';
import { TestConnectionButton } from './components/TestConnectionButton';
import { ApiKeyInput } from './components/ApiKeyInput';
import { useConfiguracoesIntegracoes } from './hooks/useConfiguracoesIntegracoes';
import { testarGatewayPagamento, testarApiSefaz, testarUrl } from './services/configuracoes.service';

const integracoesSchema = z.object({
  gateway_pagamento: z.string().min(1, 'Gateway de pagamento é obrigatório'),
  gateway_api_key: z.string().min(1, 'API Key é obrigatória'),
  gateway_secret_key: z.string().min(1, 'Secret Key é obrigatória'),
  sefaz_ambiente: z.enum(['producao', 'homologacao']),
  sefaz_certificado: z.string(),
  sefaz_senha_certificado: z.string(),
  webhook_url: z.union([z.string().url('URL inválida'), z.literal('')]).optional(),
  api_endpoint: z.union([z.string().url('URL inválida'), z.literal('')]).optional(),
});

type IntegracoesFormData = z.infer<typeof integracoesSchema>;

export default function Integracoes() {
  const { config, isLoading, handleSave, isSaving } = useConfiguracoesIntegracoes();

  const form = useForm<IntegracoesFormData>({
    resolver: zodResolver(integracoesSchema),
    defaultValues: config,
  });

  useEffect(() => {
    if (config) {
      form.reset(config);
    }
  }, [config, form]);

  function onSubmit(data: IntegracoesFormData) {
    handleSave(data as Parameters<typeof handleSave>[0]);
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
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <ConfigSection
            title="Gateway de Pagamento"
            description="Configure a integração com o gateway de pagamentos."
            icon={Link}
          >
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="gateway_pagamento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gateway</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o gateway" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="stripe">Stripe</SelectItem>
                        <SelectItem value="pagarme">Pagar.me</SelectItem>
                        <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                        <SelectItem value="cielo">Cielo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gateway_api_key"
                render={({ field }) => (
                  <FormItem>
                    <ApiKeyInput
                      label="API Key"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="pk_live_..."
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gateway_secret_key"
                render={({ field }) => (
                  <FormItem>
                    <ApiKeyInput
                      label="Secret Key"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="sk_live_..."
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-start">
                <TestConnectionButton
                  onTest={() => testarGatewayPagamento(form.getValues() as Parameters<typeof testarGatewayPagamento>[0])}
                  label="Testar Gateway"
                />
              </div>
            </div>
          </ConfigSection>

          <ConfigSection
            title="SEFAZ"
            description="Configure a integração com a SEFAZ para emissão de notas fiscais."
          >
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="sefaz_ambiente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ambiente</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o ambiente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="homologacao">Homologação</SelectItem>
                        <SelectItem value="producao">Produção</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sefaz_certificado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Certificado Digital (Base64)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Conteúdo do certificado em Base64" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sefaz_senha_certificado"
                render={({ field }) => (
                  <FormItem>
                    <ApiKeyInput
                      label="Senha do Certificado"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="••••••••"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-start">
                <TestConnectionButton
                  onTest={() => testarApiSefaz(form.getValues() as Parameters<typeof testarApiSefaz>[0])}
                  label="Testar SEFAZ"
                />
              </div>
            </div>
          </ConfigSection>

          <ConfigSection
            title="Webhooks e Endpoints"
            description="Configure URLs de webhook e endpoints de API externos."
            icon={Webhook}
          >
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="webhook_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL do Webhook</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="https://exemplo.com/webhook"
                          type="url"
                        />
                      </FormControl>
                      <TestConnectionButton
                        onTest={() => testarUrl(form.getValues('webhook_url') ?? '')}
                        label="Testar"
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="api_endpoint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endpoint de API</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="https://api.exemplo.com/v1"
                          type="url"
                        />
                      </FormControl>
                      <TestConnectionButton
                        onTest={() => testarUrl(form.getValues('api_endpoint') ?? '')}
                        label="Testar"
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </ConfigSection>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving} aria-label="Salvar configurações de integrações">
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Alterações
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
