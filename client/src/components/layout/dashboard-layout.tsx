import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCurrentUser } from "@/hooks/use-auth";
import { Bell, BellRing, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import type { Notification } from "@shared/schema";

function NotificationBell() {
  const user = getCurrentUser();
  const queryClient = useQueryClient();

  const { data: countData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count", user?.id],
    queryFn: async () => {
      if (!user) return { count: 0 };
      const r = await fetch(`/api/notifications/unread-count?userId=${user.id}`);
      return r.json();
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: notifications = [], refetch } = useQuery<Notification[]>({
    queryKey: ["/api/notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const r = await fetch(`/api/notifications?userId=${user.id}`);
      return r.json();
    },
    enabled: !!user,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await fetch("/api/notifications/read-all", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications", user?.id] });
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count", user?.id] });
      refetch();
    },
  });

  const unreadCount = countData?.count || 0;
  const typeColors: Record<string, string> = {
    urgent: "text-red-600",
    warning: "text-amber-600",
    info: "text-blue-600",
  };

  if (!user) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="relative"
          data-testid="button-notifications"
        >
          {unreadCount > 0 ? <BellRing className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" data-testid="popover-notifications">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="font-semibold text-sm">系统通知</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => markAllRead.mutate()}
              data-testid="button-mark-all-read"
            >
              <Check className="w-3 h-3" />
              全部已读
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              暂无通知
            </div>
          ) : (
            notifications.slice(0, 20).map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 border-b last:border-0 cursor-pointer transition-colors ${n.isRead ? "opacity-60" : "bg-muted/30"}`}
                onClick={() => !n.isRead && markRead.mutate(n.id)}
                data-testid={`notification-${n.id}`}
              >
                <div className="flex items-start gap-2">
                  {!n.isRead && (
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${typeColors[n.type] || ""}`}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                    {n.createdAt && (
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {format(new Date(n.createdAt), "MM-dd HH:mm")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar": "222 47% 11%",
    "--sidebar-foreground": "210 40% 98%",
    "--sidebar-border": "217 33% 17%",
    "--sidebar-accent": "217 33% 17%",
    "--sidebar-accent-foreground": "210 40% 98%",
    "--sidebar-primary-foreground": "0 0% 100%",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={style}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-16 flex items-center px-6 border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <SidebarTrigger className="mr-4" />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <NotificationBell />
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {user?.username?.slice(0, 1).toUpperCase() || "?"}
              </div>
            </div>
          </header>
          <main className="flex-1 p-6 md:p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
