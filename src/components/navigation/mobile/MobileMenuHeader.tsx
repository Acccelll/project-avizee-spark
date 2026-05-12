import { Bell, ChevronDown } from 'lucide-react';
import { SheetClose } from '@/components/ui/sheet';
import { X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { NAV_PROFILE_LABELS, type NavProfile } from '@/lib/navigation/profiles';
import { cn } from '@/lib/utils';

interface MobileMenuHeaderProps {
  profile: NavProfile;
  notificationsCount?: number;
  onOpenProfilePicker: () => void;
  onOpenNotifications: () => void;
}

export function MobileMenuHeader({
  profile,
  notificationsCount = 0,
  onOpenProfilePicker,
  onOpenNotifications,
}: MobileMenuHeaderProps) {
  const { profile: userProfile } = useAuth();
  const initials = (userProfile?.nome ?? 'AD')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="border-b border-border bg-muted/30 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
              {initials}
            </div>
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success border-2 border-background"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{userProfile?.nome ?? 'Administrador'}</p>
            <p className="truncate text-[11px] text-muted-foreground">{userProfile?.cargo ?? 'Admin'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Notificações${notificationsCount > 0 ? ` (${notificationsCount})` : ''}`}
          >
            <Bell className="h-4 w-4" />
            {notificationsCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground"
              >
                {notificationsCount > 9 ? '9+' : notificationsCount}
              </span>
            )}
          </button>
          <SheetClose asChild>
            <button
              type="button"
              className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" />
            </button>
          </SheetClose>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenProfilePicker}
        className={cn(
          'mt-3 flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left text-xs transition hover:bg-accent',
        )}
      >
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">Modo:</span>
          <span className="font-medium text-foreground">{NAV_PROFILE_LABELS[profile]}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}