import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/hooks/use-auth";
import { Users as UsersIcon, Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import type { User } from "@shared/schema";

const ROLE_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  admin: { label: "管理员", color: "bg-purple-100 text-purple-800", desc: "全部权限" },
  publisher: { label: "实验发布者", color: "bg-blue-100 text-blue-800", desc: "创建实验、分配任务、创建模板" },
  annotator: { label: "标注员", color: "bg-slate-100 text-slate-800", desc: "标注任务、查看历史" },
};

function CreateUserDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("annotator");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "创建失败");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "账号已创建", description: `用户 ${username} 创建成功。` });
      onClose();
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "创建失败", description: e.message });
    },
  });

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="new-username">用户名 *</Label>
        <Input id="new-username" value={username} onChange={e => setUsername(e.target.value)} placeholder="请输入用户名" data-testid="input-new-username" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">密码 * <span className="text-xs text-muted-foreground">（至少6位）</span></Label>
        <Input id="new-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码" data-testid="input-new-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-email">邮箱</Label>
        <Input id="new-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="请输入邮箱（可选）" data-testid="input-new-email" />
      </div>
      <div className="space-y-2">
        <Label>角色</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger data-testid="select-new-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                <div>
                  <span className="font-medium">{cfg.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">{cfg.desc}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
        <p className="font-medium mb-1">{ROLE_CONFIG[role]?.label} 权限说明：</p>
        <p>{ROLE_CONFIG[role]?.desc}</p>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>取消</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !username || !password} data-testid="button-confirm-create-user">
          {mutation.isPending ? "创建中..." : "创建账号"}
        </Button>
      </div>
    </div>
  );
}

function EditRoleDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [role, setRole] = useState(user.role);
  const [newPassword, setNewPassword] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { role };
      if (newPassword) body.password = newPassword;
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("更新失败");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "已更新", description: `用户 ${user.username} 信息已更新。` });
      onClose();
    },
    onError: () => {
      toast({ variant: "destructive", title: "更新失败" });
    },
  });

  return (
    <div className="space-y-4 pt-2">
      <div className="p-3 bg-slate-50 rounded-lg">
        <p className="text-sm text-muted-foreground">用户名</p>
        <p className="font-medium">{user.username}</p>
      </div>
      <div className="space-y-2">
        <Label>角色权限</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger data-testid="select-edit-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                <span className="font-medium">{cfg.label}</span>
                <span className="text-xs text-muted-foreground ml-2">{cfg.desc}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{ROLE_CONFIG[role]?.desc}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-password" className="flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5" />
          重置密码 <span className="text-xs text-muted-foreground">（留空则不修改）</span>
        </Label>
        <Input
          id="edit-password"
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          placeholder="输入新密码（至少6位）"
        />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>取消</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || (!!newPassword && newPassword.length < 6)} data-testid="button-confirm-edit-user">
          {mutation.isPending ? "保存中..." : "保存修改"}
        </Button>
      </div>
    </div>
  );
}

export default function Users() {
  const { data: users = [], isLoading } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "账号已删除" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "删除失败" });
    },
  });

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <UsersIcon className="w-8 h-8 text-primary" />
            用户管理
          </h1>
          <p className="text-muted-foreground mt-1">管理系统账号和权限。</p>
        </div>

        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-create-user">
                <Plus className="w-4 h-4" />
                新建账号
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>新建用户账号</DialogTitle>
              </DialogHeader>
              <CreateUserDialog onClose={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Role permissions summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
          <div key={key} className="border rounded-lg p-4 bg-white">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{cfg.desc}</p>
          </div>
        ))}
      </div>

      <Card className="premium-shadow border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="font-semibold">ID</TableHead>
                <TableHead className="font-semibold">用户名</TableHead>
                <TableHead className="font-semibold">邮箱</TableHead>
                <TableHead className="font-semibold">角色</TableHead>
                {isAdmin && <TableHead className="text-right font-semibold">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8 text-muted-foreground">加载中...</TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-8 text-muted-foreground">暂无用户。</TableCell>
                </TableRow>
              ) : (
                users.map((user) => {
                  const roleCfg = ROLE_CONFIG[user.role] ?? { label: user.role, color: "bg-slate-100 text-slate-800" };
                  const isSelf = user.id === currentUser?.id;
                  return (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="text-muted-foreground">#{user.id}</TableCell>
                      <TableCell className="font-medium">
                        {user.username}
                        {isSelf && <span className="ml-2 text-xs text-primary">（当前账号）</span>}
                      </TableCell>
                      <TableCell className="text-slate-600">{user.email || '—'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleCfg.color}`}>
                          {roleCfg.label}
                        </span>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 text-slate-600 hover:text-primary"
                                  onClick={() => setEditUser(user)}
                                  data-testid={`button-edit-user-${user.id}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  编辑
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                  <DialogTitle>编辑用户</DialogTitle>
                                </DialogHeader>
                                {editUser && editUser.id === user.id && (
                                  <EditRoleDialog user={editUser} onClose={() => setEditUser(null)} />
                                )}
                              </DialogContent>
                            </Dialog>

                            {!isSelf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (confirm(`确认删除账号"${user.username}"？此操作不可撤销。`)) {
                                    deleteMutation.mutate(user.id);
                                  }
                                }}
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
