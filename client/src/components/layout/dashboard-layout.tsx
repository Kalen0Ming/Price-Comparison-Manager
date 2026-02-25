import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCurrentUser } from "@/hooks/use-auth";
import { Bell, BellRing, Check, KeyRound, UserCircle, ShieldCheck, Clock, CheckCircle, XCircle } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Notification, RoleRequest } from "@shared/schema";

const ROLE_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  admin: { label: "管理员", color: "bg-purple-100 text-purple-800", desc: "全部权限" },
  publisher: { label: "实验发布者", color: "bg-blue-100 text-blue-800", desc: "创建实验、分配任务" },
  reviewer: { label: "复核员", color: "bg-amber-100 text-amber-800", desc: "负责复核标注结果" },
  annotator: { label: "标注员", color: "bg-slate-100 text-slate-800", desc: "标注任务、查看历史" },
};

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
        <Button size="icon" variant="ghost" className="relative" data-testid="button-notifications">
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
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => markAllRead.mutate()} data-testid="button-mark-all-read">
              <Check className="w-3 h-3" />全部已读
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />暂无通知
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
                  {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${typeColors[n.type] || ""}`}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                    {n.createdAt && (
                      <p className="text-xs text-muted-foreground/60 mt-1">{format(new Date(n.createdAt), "MM-dd HH:mm")}</p>
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

function UserProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = getCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(user?.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requestedRole, setRequestedRole] = useState("");
  const [reason, setReason] = useState("");

  const { data: myRequests = [] } = useQuery<(RoleRequest & { username?: string })[]>({
    queryKey: ["/api/role-requests", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const r = await fetch(`/api/role-requests?userId=${user.id}`);
      return r.json();
    },
    enabled: !!user && open,
  });

  const hasPending = myRequests.some(r => r.status === "pending");

  const profileMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { email };
      if (newPassword) body.password = newPassword;
      const res = await fetch(`/api/users/${user?.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("更新失败");
      return res.json();
    },
    onSuccess: (updated) => {
      if (user) localStorage.setItem("current_user", JSON.stringify({ ...user, ...updated }));
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "资料已更新" });
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: () => toast({ variant: "destructive", title: "更新失败" }),
  });

  const roleRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/role-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, requestedRole, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "提交失败");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-requests", user?.id] });
      toast({ title: "申请已提交", description: "请等待管理员审核。" });
      setRequestedRole("");
      setReason("");
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "提交失败", description: e.message }),
  });

  const canSaveProfile = email !== (user?.email || "") || (newPassword && newPassword.length >= 6 && newPassword === confirmPassword);

  const statusIcon: Record<string, React.ElementType> = {
    pending: Clock,
    approved: CheckCircle,
    rejected: XCircle,
  };
  const statusColor: Record<string, string> = {
    pending: "text-amber-600",
    approved: "text-green-600",
    rejected: "text-red-500",
  };
  const statusLabel: Record<string, string> = {
    pending: "待审核",
    approved: "已批准",
    rejected: "已拒绝",
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="w-5 h-5 text-primary" />
            我的账号
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg mb-1">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold">{user.username}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_CONFIG[user.role]?.color || "bg-slate-100 text-slate-700"}`}>
              {ROLE_CONFIG[user.role]?.label || user.role}
            </span>
          </div>
        </div>

        <Tabs defaultValue="profile">
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="flex-1">修改资料</TabsTrigger>
            <TabsTrigger value="role" className="flex-1">申请权限</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 pt-3">
            <div className="space-y-2">
              <Label htmlFor="dialog-email">邮箱</Label>
              <Input id="dialog-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="请输入邮箱" data-testid="input-dialog-email" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                新密码 <span className="text-xs text-muted-foreground">（留空则不修改）</span>
              </Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="至少6位" data-testid="input-dialog-password" />
            </div>
            {newPassword && (
              <div className="space-y-2">
                <Label>确认新密码</Label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="再次输入新密码" data-testid="input-dialog-confirm-password" />
                {newPassword && confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500">两次密码不一致</p>
                )}
              </div>
            )}
            <Button className="w-full" onClick={() => profileMutation.mutate()} disabled={!canSaveProfile || profileMutation.isPending} data-testid="button-save-profile-dialog">
              {profileMutation.isPending ? "保存中..." : "保存修改"}
            </Button>
          </TabsContent>

          <TabsContent value="role" className="space-y-4 pt-3">
            {hasPending ? (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                <span>你已有一个待审核的申请，请等待管理员处理后再提交新申请。</span>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    申请的角色
                  </Label>
                  <Select value={requestedRole} onValueChange={setRequestedRole}>
                    <SelectTrigger data-testid="select-dialog-role"><SelectValue placeholder="选择目标角色" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_CONFIG)
                        .filter(([key]) => key !== user.role && key !== "admin")
                        .map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>
                            <span className="font-medium">{cfg.label}</span>
                            <span className="text-xs text-muted-foreground ml-2">{cfg.desc}</span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>申请理由 <span className="text-muted-foreground text-xs">（可选）</span></Label>
                  <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="请简述申请原因..." rows={3} data-testid="textarea-dialog-reason" />
                </div>
                <Button className="w-full" onClick={() => roleRequestMutation.mutate()} disabled={!requestedRole || roleRequestMutation.isPending} data-testid="button-submit-role-dialog">
                  {roleRequestMutation.isPending ? "提交中..." : "提交申请"}
                </Button>
              </>
            )}

            {myRequests.length > 0 && (
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">历史申请</p>
                {myRequests.slice(0, 5).map(req => {
                  const Icon = statusIcon[req.status] || Clock;
                  return (
                    <div key={req.id} className="flex items-center justify-between text-xs py-1.5 border-b last:border-0">
                      <span className="font-medium">{ROLE_CONFIG[req.requestedRole]?.label || req.requestedRole}</span>
                      <span className={`flex items-center gap-1 ${statusColor[req.status] || ""}`}>
                        <Icon className="w-3 h-3" />{statusLabel[req.status] || req.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = getCurrentUser();
  const [profileOpen, setProfileOpen] = useState(false);
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
              <button
                onClick={() => setProfileOpen(true)}
                className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm hover:bg-primary/20 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                title="点击编辑个人资料"
                data-testid="button-user-avatar"
              >
                {user?.username?.slice(0, 1).toUpperCase() || "?"}
              </button>
            </div>
          </header>
          <main className="flex-1 p-6 md:p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
      <UserProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
    </SidebarProvider>
  );
}
