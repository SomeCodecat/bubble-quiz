"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFormatter } from "next-intl";

interface EditLog {
  id: string;
  timestamp: Date;
  details: string | null;
  user: {
    name: string | null;
    image: string | null;
    username: string | null;
  };
}

interface Props {
  logs: EditLog[];
  title?: string;
}

export function AuditLogViewer({ logs, title = "Edit History" }: Props) {
  const format = useFormatter();

  if (logs.length === 0) {
    return (
        <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
            No edit history available.
        </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <ScrollArea className="h-[200px] w-full rounded-md border p-4">
        <div className="space-y-4">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-4">
              <Avatar className="h-8 w-8 mt-0.5">
                <AvatarImage src={log.user.image || undefined} alt={log.user.name || "User"} />
                <AvatarFallback>{(log.user.name || "U")[0]}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium leading-none">
                    {log.user.name || log.user.username || "Unknown User"}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {format.relativeTime(log.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {log.details || "Edited question"}
                </p>
                 <div className="text-[10px] text-muted-foreground/50">
                    {format.dateTime(log.timestamp, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric'
                    })}
                 </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
