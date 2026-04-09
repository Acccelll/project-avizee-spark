import { Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { quickActions } from '@/lib/navigation';

export function MobileQuickActions() {
  const navigate = useNavigate();

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-[5.8rem] right-4 z-40 h-14 w-14 rounded-full shadow-xl md:hidden"
          aria-label="Atalhos rápidos"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[70vh] rounded-t-[20px] md:hidden">
        <DrawerHeader className="text-left">
          <div className="flex items-center justify-between gap-2">
            <DrawerTitle>Atalhos rápidos</DrawerTitle>
            <DrawerClose asChild>
              <button
                type="button"
                className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Fechar atalhos rápidos"
              >
                <X className="h-4 w-4" />
              </button>
            </DrawerClose>
          </div>
          <DrawerDescription>Crie ou acesse as ações mais usadas com um toque.</DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-2 px-4 pb-8">
          {quickActions.map((action) => (
            <Button
              key={action.id}
              variant="secondary"
              className="h-auto justify-start rounded-xl px-4 py-4 text-left"
              onClick={() => navigate(action.path)}
            >
              <div>
                <p className="text-sm font-semibold">{action.title}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
            </Button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
