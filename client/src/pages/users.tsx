import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/hooks/use-auth";
import {
  Users as UsersIcon, Plus, Pencil, Trash2, KeyRound, UserCircle,
  ShieldCheck, Users2, ClipboardCheck, CheckCircle, XCircle, Clock,
} from "lucide-react";
import type { User, UserGroup, RoleRequest } from "@shared/schema";

const ROLE_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  admin: { label: "管理员", color: "bg-purple-100 text-purple-800", desc: "全部权限" },
  publisher: { label: "实验发布者", color: "bg-blue-100 text-blue-800", desc: "创建实验、分配任务、创建模板" },
  reviewer: { label: "复核员", color: "bg-amber-100 text-amber-800", desc: "负责复核标注结果" },
  annotator: { label: "标注员", color: "bg-slate-100 text-slate-800", desc: "标注任务、查看历史" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "待审核", color: "bg-amber-100 text-amber-700", icon: Clock },
  approved: { label: "已批准", color: "bg-green-100 text-green-700", icon: CheckCircle },
  rejected: { label: "已拒绝", color: "bg-red-100 text-red-700", icon: XCircle },
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
          <SelectTrigger data-testid="select-new-role"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>
                <span className="font-medium">{cfg.label}</span>
                <span className="text-xs text-muted-foreground ml-2">{cfg.desc}</span>
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

function EditUserDialog({ user, onClose }: { user: User; onClose: () => void }) {
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
    onError: () => toast({ variant: "destructive", title: "更新失败" }),
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
          <SelectTrigger data-testid="select-edit-role"><SelectValue /></SelectTrigger>
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
        <Input id="edit-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="输入新密码（至少6位）" />
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

function MyProfileSection({ user }: { user: User }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(user.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { email };
      if (newPassword) body.password = newPassword;
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("更新失败");
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      localStorage.setItem("current_user", JSON.stringify({ ...user, ...updated }));
      toast({ title: "资料已更新" });
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: () => toast({ variant: "destructive", title: "更新失败" }),
  });

  const canSave = email !== user.email || (newPassword && newPassword.length >= 6 && newPassword === confirmPassword);

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-primary" />
          我的资料
        </CardTitle>
        <CardDescription>修改您的邮箱和登录密码</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-w-md space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium">{user.username}</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_CONFIG[user.role]?.color}`}>
                {ROLE_CONFIG[user.role]?.label}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">邮箱</Label>
            <Input id="profile-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="请输入邮箱" data-testid="input-profile-email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-new-password" className="flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />新密码 <span className="text-xs text-muted-foreground">（留空则不修改）</span>
            </Label>
            <Input id="profile-new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="至少6位" data-testid="input-profile-password" />
          </div>
          {newPassword && (
            <div className="space-y-2">
              <Label htmlFor="profile-confirm-password">确认新密码</Label>
              <Input id="profile-confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="再次输入新密码" data-testid="input-profile-confirm-password" />
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500">两次密码不一致</p>
              )}
            </div>
          )}
          <Button onClick={() => mutation.mutate()} disabled={!canSave || mutation.isPending} data-testid="button-save-profile">
            {mutation.isPending ? "保存中..." : "保存修改"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UserGroupsSection({ users, isAdmin }: { users: User[]; isAdmin: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<UserGroup | null>(null);

  const { data: groups = [], isLoading } = useQuery<UserGroup[]>({
    queryKey: ["/api/user-groups"],
  });

  const annotators = users.filter(u => u.role === "annotator" || u.role === "reviewer");

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/user-groups/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-groups"] });
      toast({ title: "用户群已删除" });
    },
    onError: () => toast({ variant: "destructive", title: "删除失败" }),
  });

  if (!isAdmin) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-10 text-center text-muted-foreground">
          <Users2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">仅管理员可查看和管理用户群</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">用户群管理</h2>
          <p className="text-sm text-muted-foreground">创建自定义用户群，方便分配任务时批量选择标注员</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-group">
              <Plus className="w-4 h-4" />新建用户群
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>新建用户群</DialogTitle></DialogHeader>
            <GroupForm users={annotators} onClose={() => setCreateOpen(false)} onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/user-groups"] })} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">加载中...</div>
      ) : groups.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <Users2 className="w-12 h-12 mx-auto mb-3 text-slate-200" />
            <p className="text-sm text-muted-foreground mb-1">暂无用户群</p>
            <p className="text-xs text-muted-foreground">点击"新建用户群"开始创建</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(group => {
            const memberUsers = users.filter(u => (group.userIds as number[]).includes(u.id));
            return (
              <Card key={group.id} className="border-border/50" data-testid={`card-group-${group.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{group.name}</CardTitle>
                      {group.description && <CardDescription className="text-xs mt-0.5">{group.description}</CardDescription>}
                    </div>
                    <div className="flex gap-1">
                      <Dialog open={editGroup?.id === group.id} onOpenChange={open => setEditGroup(open ? group : null)}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-edit-group-${group.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader><DialogTitle>编辑用户群</DialogTitle></DialogHeader>
                          {editGroup?.id === group.id && (
                            <GroupForm group={editGroup} users={annotators} onClose={() => setEditGroup(null)} onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/user-groups"] })} />
                          )}
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        onClick={() => { if (confirm(`确认删除用户群"${group.name}"？`)) deleteMutation.mutate(group.id); }}
                        data-testid={`button-delete-group-${group.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1 mb-2">
                    <UsersIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{memberUsers.length} 名成员</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {memberUsers.slice(0, 5).map(u => (
                      <span key={u.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">
                        {u.username}
                      </span>
                    ))}
                    {memberUsers.length > 5 && (
                      <span className="text-xs text-muted-foreground">+{memberUsers.length - 5} 人</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GroupForm({ group, users, onClose, onSaved }: {
  group?: UserGroup | null;
  users: User[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(group?.name || "");
  const [description, setDescription] = useState(group?.description || "");
  const [selectedIds, setSelectedIds] = useState<number[]>((group?.userIds as number[]) || []);

  const mutation = useMutation({
    mutationFn: async () => {
      const url = group ? `/api/user-groups/${group.id}` : "/api/user-groups";
      const method = group ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, userIds: selectedIds }),
      });
      if (!res.ok) throw new Error("保存失败");
      return res.json();
    },
    onSuccess: () => {
      onSaved();
      toast({ title: group ? "用户群已更新" : "用户群已创建" });
      onClose();
    },
    onError: () => toast({ variant: "destructive", title: "保存失败" }),
  });

  const toggle = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>群组名称 *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="如：电商组、品类A组" data-testid="input-group-name" />
      </div>
      <div className="space-y-2">
        <Label>描述 <span className="text-muted-foreground text-xs">（可选）</span></Label>
        <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="简述该群组用途" data-testid="input-group-description" />
      </div>
      <div className="space-y-2">
        <Label>选择成员 <span className="text-xs text-muted-foreground">（{selectedIds.length}/{users.length} 已选）</span></Label>
        <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
          {users.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">暂无可选标注员</p>
          ) : users.map(u => (
            <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40" data-testid={`checkbox-member-${u.id}`}>
              <Checkbox checked={selectedIds.includes(u.id)} onCheckedChange={() => toggle(u.id)} />
              <span className="text-sm font-medium">{u.username}</span>
              <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${ROLE_CONFIG[u.role]?.color}`}>{ROLE_CONFIG[u.role]?.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>取消</Button>
        <Button onClick={() => mutation.mutate()} disabled={!name || mutation.isPending} data-testid="button-confirm-group">
          {mutation.isPending ? "保存中..." : group ? "更新" : "创建"}
        </Button>
      </div>
    </div>
  );
}

function RoleRequestsSection({ currentUser, isAdmin, allUsers }: { currentUser: User; isAdmin: boolean; allUsers: User[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [requestedRole, setRequestedRole] = useState("");
  const [reason, setReason] = useState("");

  const { data: requests = [], isLoading } = useQuery<(RoleRequest & { username: string })[]>({
    queryKey: ["/api/role-requests", isAdmin ? "all" : currentUser.id],
    queryFn: async () => {
      const url = isAdmin ? "/api/role-requests" : `/api/role-requests?userId=${currentUser.id}`;
      const res = await fetch(url);
      return res.json();
    },
  });

  const hasPending = requests.some((r: RoleRequest) => r.status === "pending");

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/role-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id, requestedRole, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "提交失败");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-requests"] });
      toast({ title: "申请已提交", description: "请等待管理员审核。" });
      setRequestedRole("");
      setReason("");
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "提交失败", description: e.message }),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) => {
      const res = await fetch(`/api/role-requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewedBy: currentUser.id }),
      });
      if (!res.ok) throw new Error("审核失败");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "审核完成" });
    },
    onError: () => toast({ variant: "destructive", title: "审核失败" }),
  });

  return (
    <div className="space-y-6">
      {/* Submit new request - only for non-admins */}
      {!isAdmin && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-5 h-5 text-primary" />
              申请权限升级
            </CardTitle>
            <CardDescription>您可以申请更高权限角色，申请提交后由管理员审核</CardDescription>
          </CardHeader>
          <CardContent>
            {hasPending ? (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <Clock className="w-4 h-4 shrink-0" />
                您已有一个待审核的权限申请，请等待管理员处理后再提交新申请。
              </div>
            ) : (
              <div className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label>申请角色</Label>
                  <Select value={requestedRole} onValueChange={setRequestedRole}>
                    <SelectTrigger data-testid="select-request-role"><SelectValue placeholder="选择目标角色" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_CONFIG)
                        .filter(([key]) => key !== currentUser.role && key !== "admin")
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
                  <Label htmlFor="request-reason">申请理由 <span className="text-muted-foreground text-xs">（可选）</span></Label>
                  <Textarea
                    id="request-reason"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="请简述您申请该角色的原因..."
                    rows={3}
                    data-testid="textarea-request-reason"
                  />
                </div>
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={!requestedRole || submitMutation.isPending}
                  data-testid="button-submit-role-request"
                >
                  {submitMutation.isPending ? "提交中..." : "提交申请"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Request history / admin review list */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
            {isAdmin ? "待审核申请" : "我的申请记录"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">加载中...</div>
          ) : requests.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">{isAdmin ? "暂无权限申请" : "暂无申请记录"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && <TableHead>申请人</TableHead>}
                  <TableHead>申请角色</TableHead>
                  <TableHead>申请理由</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>申请时间</TableHead>
                  {isAdmin && <TableHead className="text-right">操作</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req: any) => {
                  const statusCfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <TableRow key={req.id} data-testid={`row-role-request-${req.id}`}>
                      {isAdmin && <TableCell className="font-medium">{req.username}</TableCell>}
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_CONFIG[req.requestedRole]?.color}`}>
                          {ROLE_CONFIG[req.requestedRole]?.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{req.reason || "—"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                          <StatusIcon className="w-3 h-3" />{statusCfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {req.createdAt ? new Date(req.createdAt).toLocaleDateString("zh-CN") : "—"}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {req.status === "pending" && (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50"
                                onClick={() => reviewMutation.mutate({ id: req.id, status: "approved" })}
                                disabled={reviewMutation.isPending}
                                data-testid={`button-approve-${req.id}`}
                              >
                                <CheckCircle className="w-3 h-3" />批准
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => reviewMutation.mutate({ id: req.id, status: "rejected" })}
                                disabled={reviewMutation.isPending}
                                data-testid={`button-reject-${req.id}`}
                              >
                                <XCircle className="w-3 h-3" />拒绝
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Users() {
  const { data: users = [], isLoading } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const isAnnotator = currentUser?.role === "annotator";

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
    onError: () => toast({ variant: "destructive", title: "删除失败" }),
  });

  const defaultTab = isAnnotator ? "profile" : "users";

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <UsersIcon className="w-8 h-8 text-primary" />
            用户管理
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAnnotator ? "管理个人资料，申请角色权限" : "管理系统账号、用户群和权限申请"}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-create-user">
                <Plus className="w-4 h-4" />新建账号
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>新建用户账号</DialogTitle></DialogHeader>
              <CreateUserDialog onClose={() => setCreateOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="mb-6">
          {isAnnotator && <TabsTrigger value="profile">我的资料</TabsTrigger>}
          {!isAnnotator && <TabsTrigger value="users">用户列表</TabsTrigger>}
          {isAdmin && <TabsTrigger value="groups">用户群</TabsTrigger>}
          <TabsTrigger value="requests">权限申请</TabsTrigger>
        </TabsList>

        {/* 我的资料 - for annotators */}
        {isAnnotator && currentUser && (
          <TabsContent value="profile">
            <MyProfileSection user={currentUser} />
          </TabsContent>
        )}

        {/* 用户列表 - for non-annotators */}
        {!isAnnotator && (
          <TabsContent value="users">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {Object.entries(ROLE_CONFIG).map(([key, cfg]) => (
                <div key={key} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{(users as User[]).filter(u => u.role === key).length} 人</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{cfg.desc}</p>
                </div>
              ))}
            </div>

            <Card className="border-border/50 overflow-hidden">
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
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
                    ) : (users as User[]).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">暂无用户。</TableCell></TableRow>
                    ) : (
                      (users as User[]).map((user) => {
                        const roleCfg = ROLE_CONFIG[user.role] ?? { label: user.role, color: "bg-slate-100 text-slate-800" };
                        const isSelf = user.id === currentUser?.id;
                        return (
                          <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                            <TableCell className="text-muted-foreground">#{user.id}</TableCell>
                            <TableCell className="font-medium">
                              {user.username}
                              {isSelf && <span className="ml-2 text-xs text-primary">（当前账号）</span>}
                            </TableCell>
                            <TableCell className="text-slate-600">{user.email || "—"}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleCfg.color}`}>
                                {roleCfg.label}
                              </span>
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Dialog open={editUser?.id === user.id} onOpenChange={open => setEditUser(open ? user : null)}>
                                    <DialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="gap-1.5 text-slate-600 hover:text-primary" onClick={() => setEditUser(user)} data-testid={`button-edit-user-${user.id}`}>
                                        <Pencil className="w-3.5 h-3.5" />编辑
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                      <DialogHeader><DialogTitle>编辑用户</DialogTitle></DialogHeader>
                                      {editUser?.id === user.id && <EditUserDialog user={editUser} onClose={() => setEditUser(null)} />}
                                    </DialogContent>
                                  </Dialog>
                                  {!isSelf && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-destructive hover:bg-destructive/10"
                                      onClick={() => { if (confirm(`确认删除账号"${user.username}"？`)) deleteMutation.mutate(user.id); }}
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
          </TabsContent>
        )}

        {/* 用户群 - admin only */}
        {isAdmin && (
          <TabsContent value="groups">
            <UserGroupsSection users={users as User[]} isAdmin={isAdmin} />
          </TabsContent>
        )}

        {/* 权限申请 */}
        <TabsContent value="requests">
          {currentUser && (
            <RoleRequestsSection
              currentUser={currentUser}
              isAdmin={isAdmin}
              allUsers={users as User[]}
            />
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
