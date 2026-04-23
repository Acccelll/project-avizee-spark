import { useEffect, useState } from 'react';
import { ArrowUpRight, Building2, Mail, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useBrandingPreview } from '@/hooks/useBrandingPreview';

interface Props {
  isAdmin: boolean;
}

interface EmpresaInfo {
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
}

interface AdminContato {
  id: string;
  nome: string | null;
  email: string | null;
}

/**
 * Aba "Empresa" — visão read-only das informações cadastrais e de branding.
 *
 * Para administradores há um atalho direto para `Administração → Empresa`.
 * Para usuários comuns, mostramos os contatos dos administradores para
 * que possam solicitar correções (Fase 11 do plano de revisão).
 */
export function EmpresaInfoSection({ isAdmin }: Props) {
  const { branding } = useBrandingPreview();
  const [empresa, setEmpresa] = useState<EmpresaInfo | null>(null);
  const [admins, setAdmins] = useState<AdminContato[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: empresaRow } = await supabase
          .from('empresa_config')
          .select('razao_social, nome_fantasia, cnpj, email, telefone, cidade, uf, logradouro, numero, bairro, cep')
          .maybeSingle();
        if (cancelled) return;
        setEmpresa((empresaRow as EmpresaInfo | null) ?? null);

        if (!isAdmin) {
          // Lista admins via user_roles → profiles para fornecer contato.
          const { data: roleRows } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin');
          const ids = (roleRows ?? []).map((r) => r.user_id).filter(Boolean) as string[];
          if (ids.length > 0) {
            const { data: profRows } = await supabase
              .from('profiles')
              .select('id, nome, email')
              .in('id', ids);
            if (!cancelled) setAdmins((profRows as AdminContato[] | null) ?? []);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdmin]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Empresa
            </CardTitle>
            <CardDescription>
              Informações institucionais cadastradas para sua empresa. Esta visualização é somente leitura
              {isAdmin ? ' — use o atalho abaixo para editar globalmente.' : '. Apenas administradores podem alterar.'}
            </CardDescription>
          </div>
          {isAdmin && (
            <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
              <Link to="/administracao?tab=empresa">
                Editar em Administração
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ) : (
          <div className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <Field label="Razão social" value={empresa?.razao_social} />
            <Field label="Nome fantasia" value={empresa?.nome_fantasia} />
            <Field label="CNPJ" value={empresa?.cnpj} mono />
            <Field label="E-mail" value={empresa?.email} />
            <Field label="Telefone" value={empresa?.telefone} />
            <Field
              label="Cidade / UF"
              value={empresa?.cidade && empresa?.uf ? `${empresa.cidade} / ${empresa.uf}` : empresa?.cidade || empresa?.uf}
            />
            <Field
              label="Endereço"
              value={[empresa?.logradouro, empresa?.numero, empresa?.bairro].filter(Boolean).join(', ') || null}
              full
            />
            <Field label="CEP" value={empresa?.cep} mono />
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <p className="text-sm font-semibold">Identidade visual</p>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Marca:</span>
              <Badge variant="outline">{branding.marcaTexto || '—'}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Subtítulo:</span>
              <Badge variant="outline">{branding.marcaSubtitulo || '—'}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Cores:</span>
              {branding.corPrimaria && (
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-5 w-5 rounded border"
                    style={{ backgroundColor: branding.corPrimaria }}
                    aria-label={`Cor primária ${branding.corPrimaria}`}
                  />
                  <span className="font-mono text-[11px] text-muted-foreground">{branding.corPrimaria}</span>
                </span>
              )}
              {branding.corSecundaria && (
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-5 w-5 rounded border"
                    style={{ backgroundColor: branding.corSecundaria }}
                    aria-label={`Cor secundária ${branding.corSecundaria}`}
                  />
                  <span className="font-mono text-[11px] text-muted-foreground">{branding.corSecundaria}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {!isAdmin && (
          <>
            <Separator />
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4" />
                Para alterar dados da empresa, fale com um administrador
              </div>
              {loading ? (
                <Skeleton className="h-4 w-2/3" />
              ) : admins.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum administrador cadastrado encontrado. Procure o responsável pelo sistema.
                </p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {admins.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <span className="text-foreground">{a.nome || 'Administrador'}</span>
                      {a.email && (
                        <a
                          href={`mailto:${a.email}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {a.email}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, mono, full }: { label: string; value?: string | null; mono?: boolean; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : undefined}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={mono ? 'font-mono text-sm' : 'text-sm'}>{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}
