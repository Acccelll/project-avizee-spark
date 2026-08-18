import { FileText, Receipt, Truck, Bus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TipoDocumentoFiscal } from "@/types/domain";

interface Option { value: TipoDocumentoFiscal; label: string; description: string; icon: typeof FileText; }
const OPTIONS: Option[] = [
  { value: "nfe", label: "NF-e", description: "Mercadorias", icon: FileText },
  { value: "nfse", label: "NFS-e", description: "Serviços", icon: Receipt },
  { value: "cte", label: "CT-e", description: "Transporte de cargas", icon: Truck },
  { value: "cte_os", label: "CT-e OS", description: "Outros serviços", icon: Bus },
];
interface Props { value: TipoDocumentoFiscal; onChange: (value: TipoDocumentoFiscal) => void; disabled?: boolean; }
export function TipoDocumentoSelector({ value, onChange, disabled }: Props) {
  return <div>
    <div className="flex items-center gap-2 pb-2 border-b mb-4"><h3 className="font-semibold text-sm">Tipo de documento</h3>{disabled&&<span className="text-xs text-muted-foreground">(bloqueado após emissão)</span>}</div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{OPTIONS.map((opt)=>{const Icon=opt.icon;const active=value===opt.value;return <button key={opt.value} type="button" disabled={disabled} onClick={()=>!disabled&&onChange(opt.value)} aria-pressed={active} className={cn("rounded-lg border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",active?"border-primary bg-primary/5 ring-1 ring-primary":"border-border hover:border-primary/40 hover:bg-muted/40",disabled&&"opacity-60 cursor-not-allowed")}><div className="flex items-center gap-2"><Icon className={cn("h-4 w-4",active?"text-primary":"text-muted-foreground")}/><span className="text-sm font-semibold">{opt.label}</span></div><p className="text-xs text-muted-foreground mt-1">{opt.description}</p></button>;})}</div>
  </div>;
}
