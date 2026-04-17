// /perfil is kept as a compatibility alias that redirects to /configuracoes (canonical profile + settings page).
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Loader2 } from "lucide-react";

export default function Perfil() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/configuracoes", { replace: true });
  }, [navigate]);

  return (
    <AppLayout>
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </AppLayout>
  );
}
