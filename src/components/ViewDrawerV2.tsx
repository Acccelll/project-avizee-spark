import { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ViewDrawerV2Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  summary?: ReactNode;
  tabs?: { value: string; label: string; content: ReactNode }[];
  defaultTab?: string;
  footer?: ReactNode;
}

export function ViewDrawerV2({
  open, onClose, title, subtitle, children, badge, actions, summary, tabs, defaultTab, footer,
}: ViewDrawerV2Props) {
  const hasContextBlock = Boolean(subtitle) || Boolean(summary);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0 flex flex-col">
        <SheetHeader className="sticky top-0 z-10 bg-card border-b px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <SheetTitle className="text-lg truncate leading-tight">{title}</SheetTitle>
              <SheetDescription className="sr-only">Visualização detalhada de {title}</SheetDescription>
              {badge}
            </div>
            {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
          </div>
        </SheetHeader>

        {hasContextBlock && (
          <div className="border-b px-6 py-3 space-y-3 bg-muted/20">
            {subtitle && (
              <p className="text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
            )}
            {summary}
          </div>
        )}

        <div className="flex-1 px-6 py-4">
          {tabs && tabs.length > 0 ? (
            <Tabs defaultValue={defaultTab || tabs[0].value} className="w-full">
              <TabsList className="w-full justify-start mb-4">
                {tabs.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {tabs.map((t) => (
                <TabsContent key={t.value} value={t.value} className="space-y-5 mt-0">
                  {t.content}
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="space-y-5">{children}</div>
          )}
        </div>

        {footer && (
          <div className="sticky bottom-0 bg-card border-t px-6 py-3">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* Re-export ViewField and ViewSection for convenience */
export { ViewField, ViewSection } from "@/components/ViewDrawer";
