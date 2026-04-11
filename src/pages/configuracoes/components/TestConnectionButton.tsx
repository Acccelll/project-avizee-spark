import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TestConnectionButtonProps {
  onTest: () => Promise<{ sucesso: boolean; mensagem: string }>;
  label?: string;
}

export function TestConnectionButton({
  onTest,
  label = 'Testar Conexão',
}: TestConnectionButtonProps) {
  const [isTesting, setIsTesting] = useState(false);

  async function handleClick() {
    setIsTesting(true);
    try {
      const result = await onTest();
      if (result.sucesso) {
        toast.success(result.mensagem);
      } else {
        toast.error(result.mensagem);
      }
    } catch {
      toast.error('Erro inesperado ao testar conexão.');
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick} disabled={isTesting}>
      {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {label}
    </Button>
  );
}
