import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, XCircle, ShieldAlert, Settings } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { obterCertificadoConfigurado } from "@/services/fiscal/certificado.service";

/**
 * Exibe um alerta sobre a validade do certificado digital configurado.
 *
 * - ≤ 0 dias: crítico — emissão bloqueada
 * - ≤ 7 dias: vermelho — renovação urgente
 * - ≤ 30 dias: amarelo — aviso de vencimento próximo
 */
export function CertificadoValidadeAlert() {
  const navigate = useNavigate();
  const { data: certificado, isLoading } = useQuery({
    queryKey: ["certificado-digital"],
    queryFn: obterCertificadoConfigurado,
    staleTime: 60 * 60 * 1000,
  });

  if (isLoading || !certificado) return null;

  const { diasRestantes, razaoSocial, validadeFim } = certificado;

  const ConfigButton = (
    <Button
      size="sm"
      variant="outline"
      className="mt-3 min-h-11 gap-2"
      onClick={() => navigate("/configuracao-fiscal")}
    >
      <Settings className="h-4 w-4" /> Configurar Certificado
    </Button>
  );

  if (diasRestantes <= 0) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Certificado Digital EXPIRADO</AlertTitle>
        <AlertDescription>
          O certificado digital de <strong>{razaoSocial}</strong> está expirado desde{" "}
          {new Date(validadeFim).toLocaleDateString("pt-BR")}.
          A emissão de novos documentos fiscais está bloqueada. Renove o certificado imediatamente.
          {ConfigButton}
        </AlertDescription>
      </Alert>
    );
  }

  if (diasRestantes <= 7) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Certificado Digital expira em {diasRestantes} dia(s)!</AlertTitle>
        <AlertDescription>
          O certificado digital de <strong>{razaoSocial}</strong> vence em{" "}
          {new Date(validadeFim).toLocaleDateString("pt-BR")}. Renove urgentemente para não
          interromper a emissão de documentos fiscais.
          {ConfigButton}
        </AlertDescription>
      </Alert>
    );
  }

  if (diasRestantes <= 30) {
    return (
      <Alert className="border-yellow-500 text-yellow-800 [&>svg]:text-yellow-600">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Certificado Digital expira em {diasRestantes} dias</AlertTitle>
        <AlertDescription>
          O certificado digital de <strong>{razaoSocial}</strong> vence em{" "}
          {new Date(validadeFim).toLocaleDateString("pt-BR")}. Providencie a renovação em breve.
          {ConfigButton}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
