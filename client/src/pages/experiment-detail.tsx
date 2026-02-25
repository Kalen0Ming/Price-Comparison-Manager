import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, BarChart2, ClipboardList, Clock, CheckCircle, AlertCircle, Database, UserPlus, Shuffle, Users } from "lucide-react";
import { format } from "date-fns";
import type { Experiment, ExperimentStats, User, Task } from "@shared/schema";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    in_progress: "bg-blue-100 text-blue-700",
    archived: "bg-emerald-100 text-emerald-700",
  };
  const labels: Record<string, string> = { draft: "草稿", in_progress: "进行中", archived: "已归档" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || "bg-muted text-muted-foreground"}`}>
      {labels[status] || status}
    </span>
  );
}

function TaskStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-slate-100 text-slate-700",
    assigned: "bg-amber-100 text-amber-700",
    annotated: "bg-green-100 text-green-700",
    needs_review: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = { pending: "待分配", assigned: "待标注", annotated: "已标注", needs_review: "需复核" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] || "bg-muted"}`}>
      {labels[status] || status}
    </span>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-2">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums w-8 text-right text-muted-foreground">{value}</span>
    </div>
  );
}

// Manual assignment dialog
function ManualAssignDialog({ expId, tasks, users }: { expId: number; tasks: Task[]; users: User[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [count, setCount] = useState(5);

  const unassignedTasks = tasks.filter(t => !t.assignedTo && t.status !== "annotated");

  const assignMutation = useMutation({
    mutationFn: async () => {
      const taskIds = unassignedTasks.slice(0, count).map(t => t.id);
      const res = await fetch(`/api/experiments/${expId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: Number(selectedUser), taskIds }),
      });
      if (!res.ok) throw new Error("分配失败");
      return res.json() as Promise<{ assigned: number }>;
    },
    onSuccess: (data) => {
      const user = users.find(u => u.id === Number(selectedUser));
      toast({ title: "分配成功", description: `已为「${user?.username}」分配 ${data.assigned} 个任务。` });
      queryClient.invalidateQueries({ queryKey: ["/api/experiments", expId, "stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setOpen(false);
    },
    onError: () => toast({ variant: "destructive", title: "分配失败" }),
  });

  const annotators = users.filter(u => u.role === "annotator" || u.role === "reviewer");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-manual-assign">
          <UserPlus className="w-4 h-4" />
          手动分配
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>手动分配任务</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            当前有 <span className="font-semibold text-foreground">{unassignedTasks.length}</span> 个未分配任务。
          </p>
          <div className="space-y-1.5">
            <Label>选择标注员</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger data-testid="select-assign-user">
                <SelectValue placeholder="请选择标注员..." />
              </SelectTrigger>
              <SelectContent>
                {annotators.map(u => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.username} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>分配数量（最多 {unassignedTasks.length} 个）</Label>
            <Input
              type="number"
              min={1}
              max={unassignedTasks.length}
              value={count}
              onChange={e => setCount(Number(e.target.value))}
              data-testid="input-assign-count"
            />
          </div>
          <Button
            className="w-full"
            disabled={!selectedUser || count < 1 || assignMutation.isPending}
            onClick={() => assignMutation.mutate()}
            data-testid="button-confirm-assign"
          >
            {assignMutation.isPending ? "分配中..." : `确认分配 ${Math.min(count, unassignedTasks.length)} 个任务`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Random assignment dialog
function RandomAssignDialog({ expId, tasks, users }: { expId: number; tasks: Task[]; users: User[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

  const annotators = users.filter(u => u.role === "annotator" || u.role === "reviewer");
  const unassignedTasks = tasks.filter(t => !t.assignedTo && t.status !== "annotated");

  const randomMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/experiments/${expId}/assign-random`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: selectedUsers }),
      });
      if (!res.ok) throw new Error("分配失败");
      return res.json() as Promise<{ assigned: number; distribution: Record<number, number> }>;
    },
    onSuccess: (data) => {
      const distStr = Object.entries(data.distribution)
        .map(([uid, cnt]) => {
          const u = users.find(u => u.id === Number(uid));
          return `${u?.username || uid}: ${cnt} 个`;
        })
        .join("，");
      toast({ title: `随机分配成功，共 ${data.assigned} 个任务`, description: distStr });
      queryClient.invalidateQueries({ queryKey: ["/api/experiments", expId, "stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setOpen(false);
    },
    onError: () => toast({ variant: "destructive", title: "分配失败" }),
  });

  const toggleUser = (id: number) => {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-random-assign">
          <Shuffle className="w-4 h-4" />
          随机分配
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>随机均匀分配任务</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            将 <span className="font-semibold text-foreground">{unassignedTasks.length}</span> 个未分配任务随机均匀地分配给所选标注员。
          </p>
          <div className="space-y-2">
            <Label>选择参与的标注员（可多选）</Label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {annotators.map(u => (
                <div
                  key={u.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedUsers.includes(u.id) ? "border-primary bg-primary/5" : "border-border"}`}
                  onClick={() => toggleUser(u.id)}
                  data-testid={`option-user-${u.id}`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${selectedUsers.includes(u.id) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                    {selectedUsers.includes(u.id) && <CheckCircle className="w-3 h-3" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{u.username}</p>
                    <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
                  </div>
                  {selectedUsers.length > 0 && selectedUsers.includes(u.id) && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      ≈ {Math.ceil(unassignedTasks.length / selectedUsers.length)} 个
                    </span>
                  )}
                </div>
              ))}
              {annotators.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">暂无标注员账号，请先在用户管理中创建。</p>
              )}
            </div>
          </div>
          <Button
            className="w-full"
            disabled={selectedUsers.length === 0 || randomMutation.isPending || unassignedTasks.length === 0}
            onClick={() => randomMutation.mutate()}
            data-testid="button-confirm-random-assign"
          >
            {randomMutation.isPending ? "分配中..." : `随机分配给 ${selectedUsers.length} 名标注员`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ExperimentDetail() {
  const { id } = useParams<{ id: string }>();
  const expId = Number(id);
  const queryClient = useQueryClient();

  const { data: experiment, isLoading: expLoading } = useQuery<Experiment>({
    queryKey: ["/api/experiments", expId],
    queryFn: async () => {
      const r = await fetch(`/api/experiments/${expId}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ExperimentStats>({
    queryKey: ["/api/experiments", expId, "stats"],
    queryFn: async () => {
      const r = await fetch(`/api/experiments/${expId}/stats`);
      return r.json();
    },
  });

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks", expId],
    queryFn: async () => {
      const r = await fetch(`/api/tasks?experimentId=${expId}`);
      return r.json();
    },
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const r = await fetch("/api/users");
      return r.json();
    },
  });

  const isLoading = expLoading || statsLoading;

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4 gap-2 text-muted-foreground">
          <Link href="/experiments">
            <ArrowLeft className="w-4 h-4" />
            返回实验列表
          </Link>
        </Button>

        {expLoading ? (
          <Skeleton className="h-9 w-64 mb-2" />
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-foreground">{experiment?.name}</h1>
                {experiment && <StatusBadge status={experiment.status} />}
              </div>
              {experiment?.description && (
                <p className="text-muted-foreground mt-1">{experiment.description}</p>
              )}
              {experiment?.deadline && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  截止日期：{format(new Date(experiment.deadline), "yyyy-MM-dd HH:mm")}
                </p>
              )}
            </div>
            {/* Assignment Controls */}
            <div className="flex gap-2 flex-wrap">
              <ManualAssignDialog expId={expId} tasks={allTasks} users={users} />
              <RandomAssignDialog expId={expId} tasks={allTasks} users={users} />
            </div>
          </div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "总任务数", value: stats?.totalTasks, icon: Database, color: "text-primary" },
          { label: "待分配", value: stats?.pendingTasks, icon: ClipboardList, color: "text-slate-500" },
          { label: "待标注", value: stats?.assignedTasks, icon: Users, color: "text-amber-500" },
          { label: "已标注", value: stats?.annotatedTasks, icon: CheckCircle, color: "text-green-500" },
          { label: "需复核", value: stats?.needsReviewTasks, icon: AlertCircle, color: "text-red-500" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value ?? 0}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Task Sample */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                任务数据样本
              </CardTitle>
              <CardDescription>显示前 10 条任务的原始数据</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {statsLoading ? (
                <div className="p-6 space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : !stats?.sampleTasks?.length ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>该实验下暂无任务数据</p>
                  <Button variant="outline" size="sm" asChild className="mt-3">
                    <Link href="/import">前往导入数据</Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>分配给</TableHead>
                      <TableHead>数据字段</TableHead>
                      <TableHead>创建时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.sampleTasks.map((task, i) => {
                      const data = task.originalData as Record<string, unknown>;
                      const fieldEntries = Object.entries(data).slice(0, 2);
                      const assignedUser = task.assignedTo ? users.find(u => u.id === task.assignedTo) : null;
                      return (
                        <TableRow key={task.id} data-testid={`row-task-${task.id}`}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell><TaskStatusBadge status={task.status} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {assignedUser ? (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {assignedUser.username}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              {fieldEntries.map(([k, v]) => (
                                <p key={k} className="text-xs">
                                  <span className="text-muted-foreground">{k}:</span>{" "}
                                  <span className="font-medium">{String(v)}</span>
                                </p>
                              ))}
                              {Object.keys(data).length > 2 && (
                                <p className="text-xs text-muted-foreground">+{Object.keys(data).length - 2} 个字段</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {task.createdAt ? format(new Date(task.createdAt), "MM-dd HH:mm") : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Field Distributions */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-primary" />
                字段分布统计
              </CardTitle>
              <CardDescription>各字段的值分布情况</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : !stats?.fieldDistributions || Object.keys(stats.fieldDistributions).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">暂无分布数据</p>
              ) : (
                <div className="space-y-5">
                  {Object.entries(stats.fieldDistributions).slice(0, 5).map(([field, dist]) => {
                    const sortedEntries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
                    const maxVal = Math.max(...Object.values(dist));
                    const barColors = ["bg-primary", "bg-blue-400", "bg-cyan-400", "bg-teal-400", "bg-indigo-400"];
                    return (
                      <div key={field}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{field}</p>
                        <div className="space-y-1.5">
                          {sortedEntries.slice(0, 5).map(([val, count], i) => (
                            <div key={val}>
                              <div className="flex justify-between text-xs mb-0.5">
                                <span className="text-foreground truncate max-w-32" title={val}>{val || "(空)"}</span>
                              </div>
                              <MiniBar value={count} max={maxVal} color={barColors[i % barColors.length]} />
                            </div>
                          ))}
                          {sortedEntries.length > 5 && (
                            <p className="text-xs text-muted-foreground">+{sortedEntries.length - 5} 个其他值</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
