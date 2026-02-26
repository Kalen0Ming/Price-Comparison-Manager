import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, BarChart2, ClipboardList, Clock, CheckCircle, AlertCircle, AlertTriangle, Database, UserPlus, Shuffle, Users, ShieldCheck, Gavel, ChevronRight, Archive, Download, Loader2, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import type { Experiment, ExperimentStats, User, Task, Annotation, UserGroup } from "@shared/schema";

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
    needs_review: "bg-orange-100 text-orange-700",
    completed: "bg-emerald-100 text-emerald-700",
  };
  const labels: Record<string, string> = { pending: "待分配", assigned: "待标注", annotated: "已标注", needs_review: "待复核", completed: "已完成" };
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

// Shared helper for user/group picker list
function PickerUserList({
  users, selected, onToggle, totalTasks,
}: { users: User[]; selected: number[]; onToggle: (id: number) => void; totalTasks?: number }) {
  return (
    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
      {users.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">暂无标注员账号</p>}
      {users.map(u => (
        <div
          key={u.id}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${selected.includes(u.id) ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
          onClick={() => onToggle(u.id)}
          data-testid={`option-user-${u.id}`}
        >
          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected.includes(u.id) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
            {selected.includes(u.id) && <CheckCircle className="w-3 h-3" />}
          </div>
          <span className="text-sm font-medium flex-1">{u.username}</span>
          {totalTasks !== undefined && selected.length > 0 && selected.includes(u.id) && (
            <span className="text-xs text-muted-foreground">≈ {Math.ceil(totalTasks / selected.length)} 个</span>
          )}
        </div>
      ))}
    </div>
  );
}

function PickerGroupList({
  groups, selected, onToggle,
}: { groups: UserGroup[]; selected: number[]; onToggle: (id: number) => void }) {
  return (
    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
      {groups.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">暂无用户组，请先在用户管理中创建</p>}
      {groups.map(g => (
        <div
          key={g.id}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${selected.includes(g.id) ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
          onClick={() => onToggle(g.id)}
          data-testid={`option-group-${g.id}`}
        >
          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selected.includes(g.id) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
            {selected.includes(g.id) && <CheckCircle className="w-3 h-3" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{g.name}</p>
            <p className="text-xs text-muted-foreground">{(g.userIds as number[]).length} 名成员</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: "users" | "groups"; onChange: (m: "users" | "groups") => void }) {
  return (
    <div className="flex rounded-md border overflow-hidden text-xs h-7">
      <button
        type="button"
        className={`px-3 transition-colors ${mode === "users" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        onClick={() => onChange("users")}
      >个人</button>
      <button
        type="button"
        className={`px-3 border-l transition-colors ${mode === "groups" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        onClick={() => onChange("groups")}
      >用户组</button>
    </div>
  );
}

// Random assignment dialog — supports user groups + reviewer pool pre-selection
function RandomAssignDialog({
  expId, tasks, users, userGroups, experiment,
}: { expId: number; tasks: Task[]; users: User[]; userGroups: UserGroup[]; experiment: Experiment | undefined }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [annotatorMode, setAnnotatorMode] = useState<"users" | "groups">("users");
  const [reviewerMode, setReviewerMode] = useState<"users" | "groups">("users");
  const [annotatorUsers, setAnnotatorUsers] = useState<number[]>([]);
  const [annotatorGroups, setAnnotatorGroups] = useState<number[]>([]);
  const [reviewerUsers, setReviewerUsers] = useState<number[]>([]);
  const [reviewerGroups, setReviewerGroups] = useState<number[]>([]);

  const annotatorList = users.filter(u => u.role === "annotator" || u.role === "reviewer");
  const unassignedTasks = tasks.filter(t => !t.assignedTo && t.status !== "annotated");

  // Compute effective annotator count for display
  const effectiveAnnotatorIds = Array.from(new Set([
    ...annotatorUsers,
    ...annotatorGroups.flatMap(gid => {
      const g = userGroups.find(g => g.id === gid);
      return g ? (g.userIds as number[]) : [];
    }),
  ]));

  const toggle = (set: number[], setFn: (v: number[]) => void, id: number) => {
    setFn(set.includes(id) ? set.filter(x => x !== id) : [...set, id]);
  };

  const randomMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/experiments/${expId}/assign-random`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: annotatorUsers,
          groupIds: annotatorGroups,
          reviewerUserIds: reviewerUsers,
          reviewerGroupIds: reviewerGroups,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "分配失败");
      }
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
      queryClient.invalidateQueries({ queryKey: ["/api/experiments", expId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", expId] });
      setOpen(false);
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "分配失败", description: e.message }),
  });

  const canSubmit = effectiveAnnotatorIds.length > 0 && unassignedTasks.length > 0 && !randomMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-random-assign">
          <Shuffle className="w-4 h-4" />
          随机分配
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>随机均匀分配任务</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <p className="text-sm text-muted-foreground">
            将 <span className="font-semibold text-foreground">{unassignedTasks.length}</span> 个未分配任务随机均匀地分配给所选标注员。
          </p>

          {/* Annotator selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">标注人员</Label>
              <ModeToggle mode={annotatorMode} onChange={m => { setAnnotatorMode(m); setAnnotatorUsers([]); setAnnotatorGroups([]); }} />
            </div>
            {annotatorMode === "users" ? (
              <PickerUserList
                users={annotatorList}
                selected={annotatorUsers}
                onToggle={id => toggle(annotatorUsers, setAnnotatorUsers, id)}
                totalTasks={unassignedTasks.length}
              />
            ) : (
              <PickerGroupList
                groups={userGroups}
                selected={annotatorGroups}
                onToggle={id => toggle(annotatorGroups, setAnnotatorGroups, id)}
              />
            )}
            {effectiveAnnotatorIds.length > 0 && (
              <p className="text-xs text-primary">已选 {effectiveAnnotatorIds.length} 名标注员，每人约 {Math.ceil(unassignedTasks.length / effectiveAnnotatorIds.length)} 个任务</p>
            )}
          </div>

          {/* Reviewer pool selection (only when review enabled) */}
          {experiment?.enableReview && (
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold">复核人员池</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    标注员提交初标后，按 {experiment.reviewRatio}% 抽取自动分配给以下人员复核
                  </p>
                </div>
                <ModeToggle mode={reviewerMode} onChange={m => { setReviewerMode(m); setReviewerUsers([]); setReviewerGroups([]); }} />
              </div>
              {reviewerMode === "users" ? (
                <PickerUserList
                  users={annotatorList}
                  selected={reviewerUsers}
                  onToggle={id => toggle(reviewerUsers, setReviewerUsers, id)}
                />
              ) : (
                <PickerGroupList
                  groups={userGroups}
                  selected={reviewerGroups}
                  onToggle={id => toggle(reviewerGroups, setReviewerGroups, id)}
                />
              )}
            </div>
          )}

          <Button
            className="w-full"
            disabled={!canSubmit}
            onClick={() => randomMutation.mutate()}
            data-testid="button-confirm-random-assign"
          >
            {randomMutation.isPending
              ? "分配中..."
              : `随机分配给 ${effectiveAnnotatorIds.length} 名标注员`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveDialog({ expId, expName, expStatus }: { expId: number; expName: string; expStatus: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [shufangResult, setShufangResult] = useState<string | null>(null);

  const handleArchive = async () => {
    setIsArchiving(true);
    setShufangResult(null);
    try {
      const res = await fetch(`/api/experiments/${expId}/archive`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "归档失败" }));
        throw new Error(err.message);
      }
      const sfStatus = res.headers.get("X-Shufang-Status") || "not_configured";
      setShufangResult(sfStatus);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `experiment_${expId}_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      queryClient.invalidateQueries({ queryKey: ["/api/experiments", expId] });
      queryClient.invalidateQueries({ queryKey: ["/api/experiments"] });

      const sfLabel = sfStatus === "success"
        ? "已成功同步至数坊"
        : sfStatus === "not_configured"
        ? "数坊集成未配置，仅本地下载"
        : `数坊同步失败：${sfStatus}`;
      toast({ title: "实验已归档并下载 ZIP", description: sfLabel });
    } catch (e: any) {
      toast({ variant: "destructive", title: "归档失败", description: e.message });
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
          disabled={expStatus === "archived"}
          data-testid="button-archive-experiment"
        >
          <Archive className="w-4 h-4" />
          {expStatus === "archived" ? "已归档" : "归档实验"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-amber-600" />
            归档实验
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-semibold mb-1">将对实验「{expName}」执行以下操作：</p>
            <ul className="list-disc list-inside space-y-1 text-amber-700">
              <li>将实验状态标记为"已归档"</li>
              <li>导出全部任务数据为 <code>tasks.csv</code></li>
              <li>导出全部标注数据为 <code>annotations.csv</code></li>
              <li>包含实验配置 <code>experiment.json</code></li>
              <li>打包成 ZIP 自动下载</li>
              <li>如已配置数坊集成，自动同步上传</li>
            </ul>
          </div>

          {shufangResult && (
            <div className={`rounded-lg p-3 text-sm ${shufangResult === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : shufangResult === "not_configured" ? "bg-slate-50 border border-slate-200 text-slate-600" : "bg-red-50 border border-red-200 text-red-700"}`}>
              <strong>数坊同步：</strong>
              {shufangResult === "success" && " 已成功上传至数坊数据仓库"}
              {shufangResult === "not_configured" && " 数坊集成未配置，可在仪表盘顶部配置"}
              {!["success", "not_configured"].includes(shufangResult) && ` ${shufangResult}`}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={isArchiving}>
              取消
            </Button>
            <Button
              className="flex-1 gap-2 bg-amber-600 hover:bg-amber-700"
              onClick={handleArchive}
              disabled={isArchiving}
              data-testid="button-confirm-archive"
            >
              {isArchiving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />归档中...</>
              ) : (
                <><Download className="w-4 h-4" />确认归档并下载</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResetAssignDialog({ expId, tasks, expStatus }: { expId: number; tasks: Task[]; expStatus: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const assignedCount = tasks.filter(t => t.status === "assigned").length;

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/experiments/${expId}/reset-assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("重置失败");
      return res.json() as Promise<{ reset: number }>;
    },
    onSuccess: (data) => {
      toast({ title: "重置成功", description: `已将 ${data.reset} 条任务恢复为待分配状态。` });
      queryClient.invalidateQueries({ queryKey: ["/api/experiments", expId, "stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setOpen(false);
    },
    onError: () => toast({ variant: "destructive", title: "重置失败", description: "请稍后再试" }),
  });

  if (expStatus === "archived" || assignedCount === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50"
          data-testid="button-reset-assignments"
        >
          <RotateCcw className="w-4 h-4" />
          重置分配
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-rose-600" />
            重置任务分配
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <p>将还原 <span className="font-bold">{assignedCount}</span> 条已分配但未标注的任务为「待分配」状态，之后可重新分配给标注员。</p>
            <p className="mt-1.5 text-rose-600 text-xs">注意：仅处理"待标注"状态的任务，已完成标注的任务不受影响。</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={resetMutation.isPending}
            >
              取消
            </Button>
            <Button
              className="flex-1 gap-2 bg-rose-600 hover:bg-rose-700"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              data-testid="button-confirm-reset"
            >
              {resetMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />重置中...</>
              ) : (
                <>确认重置 {assignedCount} 条任务</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ReviewQueueItem = Task & {
  initialAnnotation: Annotation | null;
  reviewAnnotation: Annotation | null;
  annotatorUser: { id: number; username: string } | null;
  reviewerUser: { id: number; username: string } | null;
  hasConflict: boolean;
};

export default function ExperimentDetail() {
  const { id } = useParams<{ id: string }>();
  const expId = Number(id);
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

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

  const { data: userGroups = [] } = useQuery<UserGroup[]>({
    queryKey: ["/api/user-groups"],
    queryFn: async () => {
      const r = await fetch("/api/user-groups");
      return r.json();
    },
  });

  const { data: reviewQueue = [], isLoading: reviewLoading } = useQuery<ReviewQueueItem[]>({
    queryKey: ["/api/experiments", expId, "review-queue"],
    queryFn: async () => {
      const r = await fetch(`/api/experiments/${expId}/review-queue`);
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
            {/* Assignment & Archive Controls */}
            <div className="flex gap-2 flex-wrap">
              <ManualAssignDialog expId={expId} tasks={allTasks} users={users} />
              <RandomAssignDialog
                expId={expId}
                tasks={allTasks}
                users={users}
                userGroups={userGroups}
                experiment={experiment}
              />
              <ResetAssignDialog expId={expId} tasks={allTasks} expStatus={experiment?.status || ""} />
              <ArchiveDialog
                expId={expId}
                expName={experiment?.name || ""}
                expStatus={experiment?.status || ""}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stat Cards */}
      {(() => {
        const unassignedReviewCount = allTasks.filter(t => t.status === "needs_review" && !t.reviewedBy).length;
        const baseStats = [
          { label: "总任务数", value: stats?.totalTasks, icon: Database, color: "text-primary" },
          { label: "待分配", value: stats?.pendingTasks, icon: ClipboardList, color: "text-slate-500" },
          { label: "待标注", value: stats?.assignedTasks, icon: Users, color: "text-amber-500" },
          { label: "已标注", value: stats?.annotatedTasks, icon: CheckCircle, color: "text-green-500" },
          { label: "已进入复核", value: stats?.needsReviewTasks, icon: AlertCircle, color: "text-violet-500" },
        ];
        const reviewStats = experiment?.enableReview
          ? [{ label: "待分配复核", value: unassignedReviewCount, icon: ShieldCheck, color: "text-violet-600" }]
          : [];
        const allStats = [...baseStats, ...reviewStats];
        const colCls = allStats.length === 6
          ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
          : "grid-cols-2 md:grid-cols-5";
        return (
          <div className={`grid ${colCls} gap-4 mb-8`}>
            {allStats.map((stat) => (
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
        );
      })()}

      {/* Reviewer pool info banner */}
      {experiment?.enableReview && (
        <div className={`flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border mb-6 text-sm ${(experiment.reviewerPool as number[] | null)?.length ? "bg-violet-50 border-violet-200" : "bg-amber-50 border-amber-200"}`}>
          <ShieldCheck className={`w-4 h-4 shrink-0 ${(experiment.reviewerPool as number[] | null)?.length ? "text-violet-600" : "text-amber-600"}`} />
          <span className={(experiment.reviewerPool as number[] | null)?.length ? "text-violet-700 font-medium" : "text-amber-700 font-medium"}>
            {(experiment.reviewerPool as number[] | null)?.length
              ? `已配置复核人员池（${(experiment.reviewerPool as number[]).length} 人）：`
              : "尚未配置复核人员池 — 请在「随机分配」时选择复核人员，否则抽中的任务将需手动指定"}
          </span>
          {(experiment.reviewerPool as number[] | null)?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {(experiment.reviewerPool as number[]).map(uid => {
                const u = users.find(u => u.id === uid);
                return u ? (
                  <span key={uid} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-medium">
                    {u.username}
                  </span>
                ) : null;
              })}
            </div>
          ) : null}
          <span className="text-xs text-muted-foreground ml-auto">抽样比例 {experiment.reviewRatio}%</span>
        </div>
      )}

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
                    <Link href={`/import?experimentId=${id}`}>前往导入数据</Link>
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

      {/* Review Queue Section */}
      {(reviewQueue.length > 0 || experiment?.enableReview) && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-500" />
                    复核队列
                    {experiment?.enableReview && (
                      <Badge variant="outline" className="text-xs ml-1">
                        抽样比例 {experiment.reviewRatio}%
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    已进入复核流程的任务，点击任意行可查看初标/复标对比并进行裁定
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    待复核 {reviewQueue.filter(t => t.status === "needs_review").length}
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    已完成 {reviewQueue.filter(t => t.status === "completed").length}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {reviewLoading ? (
                <div className="p-6 space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : reviewQueue.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <ShieldCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">暂无任务进入复核流程</p>
                  <p className="text-xs mt-1">
                    {experiment?.enableReview
                      ? `当标注员提交初标后，系统将按 ${experiment.reviewRatio}% 概率随机抽取进行复核`
                      : "该实验未开启复核功能"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">任务</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>初标员</TableHead>
                      <TableHead>复核员</TableHead>
                      <TableHead>分歧</TableHead>
                      <TableHead>初标结果预览</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewQueue.map((item) => {
                      const initResult = item.initialAnnotation?.result as Record<string, unknown> | null;
                      const reviewResult = item.reviewAnnotation?.result as Record<string, unknown> | null;
                      const LABELS: Record<string, Record<string, string>> = {
                        is_same_product: { yes: "同款", no: "非同款", uncertain: "不确定" },
                        price_comparison: { "A>B": "A贵", "A<B": "B贵", "A=B": "相同", unknown: "未知" },
                      };
                      return (
                        <TableRow
                          key={item.id}
                          className={`cursor-pointer hover:bg-muted/40 transition-colors ${item.hasConflict ? "bg-red-50/50" : ""}`}
                          onClick={() => setLocation(`/review/${item.id}`)}
                          data-testid={`row-review-${item.id}`}
                        >
                          <TableCell className="font-mono text-xs text-muted-foreground">#{item.id}</TableCell>
                          <TableCell><TaskStatusBadge status={item.status} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.annotatorUser?.username || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {item.reviewerUser?.username || "待分配"}
                          </TableCell>
                          <TableCell>
                            {item.hasConflict ? (
                              <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                                <AlertTriangle className="w-3 h-3" /> 有分歧
                              </span>
                            ) : item.reviewAnnotation ? (
                              <span className="text-xs text-green-600">✓ 一致</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">待复核</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {initResult ? (
                              <div className="flex gap-1.5 flex-wrap">
                                {Object.entries(initResult)
                                  .filter(([k]) => k !== "notes")
                                  .slice(0, 2)
                                  .map(([k, v]) => (
                                    <span key={k} className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">
                                      {LABELS[k]?.[String(v)] || String(v)}
                                    </span>
                                  ))
                                }
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="gap-1 text-xs h-7 px-2" data-testid={`button-view-review-${item.id}`}>
                              {item.status === "completed" ? (
                                <><CheckCircle className="w-3 h-3 text-green-500" /> 查看</>
                              ) : item.reviewAnnotation ? (
                                <><Gavel className="w-3 h-3 text-primary" /> 裁定</>
                              ) : (
                                <><ChevronRight className="w-3 h-3" /> 待复核</>
                              )}
                            </Button>
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
      )}
    </DashboardLayout>
  );
}
