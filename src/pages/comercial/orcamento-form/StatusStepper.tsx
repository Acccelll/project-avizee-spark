/** Mini stepper de status do orçamento — destaca a etapa atual. */
export function StatusStepper({ status }: { status: string }) {
  const steps = [
    { key: "rascunho", label: "Rascunho", match: ["rascunho"] },
    { key: "pendente", label: "Aprovação", match: ["pendente"] },
    { key: "aprovado", label: "Aprovado", match: ["aprovado"] },
    { key: "convertido", label: "Pedido", match: ["convertido"] },
  ];
  const currentIdx = steps.findIndex((s) => s.match.includes(status));
  const isTerminal = ["rejeitado", "cancelado", "expirado", "historico"].includes(status);
  if (isTerminal) {
    return (
      <p className="text-[11px] text-muted-foreground">Status terminal: <span className="font-medium text-foreground capitalize">{status}</span></p>
    );
  }
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1" aria-label="Fluxo do orçamento">
      {steps.map((s, i) => {
        const active = i === currentIdx;
        const done = currentIdx >= 0 && i < currentIdx;
        return (
          <div key={s.key} className="flex items-center gap-1 min-w-0">
            <span
              className={
                "inline-block h-1.5 w-1.5 rounded-full shrink-0 " +
                (active ? "bg-primary ring-2 ring-primary/30" : done ? "bg-primary/60" : "bg-muted-foreground/30")
              }
            />
            <span className={"text-[10px] " + (active ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="hidden sm:inline text-muted-foreground/40 text-[10px]">›</span>}
          </div>
        );
      })}
    </div>
  );
}