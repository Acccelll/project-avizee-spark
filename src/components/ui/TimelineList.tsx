import { Clock } from "lucide-react";

interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  date: string;
  type?: string;
}

interface Props {
  items: TimelineItem[];
  emptyMessage?: string;
}

export function TimelineList({ items, emptyMessage = "Nenhum registro" }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex gap-3 items-start">
          <div className="mt-1 p-1.5 rounded-full bg-accent flex-shrink-0">
            <Clock className="w-3 h-3 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">{item.title}</p>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {new Date(item.date).toLocaleDateString("pt-BR")} {new Date(item.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
            {item.type && <span className="text-xs text-primary font-medium">{item.type}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
