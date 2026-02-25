import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentUser } from "@/hooks/use-auth";
import {
  ClipboardList, ChevronRight, Clock, CheckCircle, AlertCircle,
  AlertTriangle, Eye, Hash, ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import type { Task, Experiment, Annotation, AnnotationTemplate } from "@shared/schema";

type ExperimentItem = {
  experiment: Experiment;
  template: AnnotationTemplate | null;
  totalTasks: number;
  annotatedTasks: number;
};

type ReviewTask = Task & {
  experiment: Experiment | null;
  initialAnnotation: Annotation | null;
};

type ReviewGroup = {
  experiment: Experiment;
  tasks: ReviewTask[];
  completedCount: number;
};

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  P1: { label: "P1 紧急", bg: "bg-red-100", text: "text-red-700", border: "border-l-red-500" },
  P2: { label: "P2 普通", bg: "bg-amber-100", text: "text-amber-700", border: "border-l-amber-400" },
  P3: { label: "P3 低优先", bg: "bg-slate-100", text: "text-slate-600", border: "border-l-slate-300" },
};

function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  const cfg = PRIORITY_CONFIG[priority ?? "P2"] ?? PRIORITY_CONFIG.P2;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function DeadlineBadge({ deadline }: { deadline: string | Date | null | undefined }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!deadline) return null;
  const d = new Date(deadline);
  const diffMs = d.getTime() - now.getTime();
  const isPast = diffMs <= 0;
  const abs = Math.abs(diffMs);
  const totalSecs = Math.floor(abs / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  const timeStr = days > 0
    ? `${days}天 ${pad(hours)}:${pad(mins)}:${pad(secs)}`
    : `${pad(hours)}:${pad(mins)}:${pad(secs)}`;

  if (isPast) return (
    <span className="text-xs text-red-600 font-semibold flex items-center gap-1 tabular-nums">
      <AlertTriangle className="w-3 h-3" />已超期 {timeStr}
    </span>
  );
  if (diffMs < 86400_000) return (
    <span className="text-xs text-red-500 font-semibold flex items-center gap-1 tabular-nums">
      <AlertCircle className="w-3 h-3" />紧急·还剩 {timeStr}
    </span>
  );
  if (diffMs < 3 * 86400_000) return (
    <span className="text-xs text-amber-600 flex items-center gap-1 tabular-nums">
      <Clock className="w-3 h-3" />截止 {format(d, "MM-dd HH:mm")}·还剩 {timeStr}
    </span>
  );
  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1 tabular-nums">
      <Clock className="w-3 h-3" />截止 {format(d, "MM-dd HH:mm")}·还剩 {timeStr}
    </span>
  );
}

export default function MyTasks() {
  const user = getCurrentUser();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState<"annotation" | "review">("annotation");

  const { data: items = [], isLoading } = useQuery<ExperimentItem[]>({
    queryKey: ["/api/my-experiments", user?.id, isAdmin],
    queryFn: async () => {
      if (!user) return [];
      const url = isAdmin ? "/api/my-experiments?all=true" : `/api/my-experiments?userId=${user.id}`;
      const res = await fetch(url);
      return res.json();
    },
    enabled: !!user,
  });

  const { data: reviewTasks = [], isLoading: reviewLoading } = useQuery<ReviewTask[]>({
    queryKey: ["/api/review-tasks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const res = await fetch(`/api/review-tasks?userId=${user.id}`);
      return res.json();
    },
    enabled: !!user,
  });

  const reviewGroups: ReviewGroup[] = (() => {
    const map = new Map<number, ReviewGroup>();
    for (const task of reviewTasks) {
      if (!task.experiment) continue;
      const expId = task.experiment.id;
      if (!map.has(expId)) {
        map.set(expId, { experiment: task.experiment, tasks: [], completedCount: 0 });
      }
      const g = map.get(expId)!;
      g.tasks.push(task);
      if (task.status === "completed" || task.status === "annotated") g.completedCount++;
    }
    return Array.from(map.values());
  })();

  const pending = items.filter(i => i.annotatedTasks < i.totalTasks);
  const done = items.filter(i => i.annotatedTasks >= i.totalTasks && i.totalTasks > 0);

  const renderAnnotationCard = (item: ExperimentItem) => {
    const { experiment: exp, totalTasks, annotatedTasks } = item;
    const pct = totalTasks > 0 ? Math.round((annotatedTasks / totalTasks) * 100) : 0;
    const cfg = PRIORITY_CONFIG[exp.priority ?? "P2"] ?? PRIORITY_CONFIG.P2;
    const isDone = annotatedTasks >= totalTasks && totalTasks > 0;

    return (
      <Card
        key={exp.id}
        className={`cursor-pointer hover-elevate transition-shadow border-l-4 ${cfg.border} ${isDone ? "opacity-75" : ""}`}
        onClick={() => setLocation(`/my-tasks/${exp.id}`)}
        data-testid={`card-experiment-${exp.id}`}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <PriorityBadge priority={exp.priority} />
                {isDone && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                    <CheckCircle className="w-3 h-3" />已完成
                  </span>
                )}
                {exp.code && (
                  <span className="text-xs text-muted-foreground font-mono flex items-center gap-0.5">
                    <Hash className="w-3 h-3" />{exp.code}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-foreground text-base mb-1 truncate" data-testid={`text-exp-name-${exp.id}`}>
                {exp.name}
              </h3>
              {exp.description && (
                <p className="text-xs text-muted-foreground mb-2 truncate">{exp.description}</p>
              )}
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  共 <span className="font-semibold text-foreground">{totalTasks}</span> 条数据
                </span>
                <span className="text-xs text-muted-foreground">
                  已标注 <span className={`font-semibold ${isDone ? "text-green-600" : "text-primary"}`}>{annotatedTasks}</span> 条
                </span>
                <DeadlineBadge deadline={exp.deadline} />
              </div>
              <div className="mt-3 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isDone ? "bg-green-500" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{pct}% 完成</p>
            </div>
            <div className="flex-shrink-0 mt-1">
              <Button size="sm" className="gap-1.5" variant={isDone ? "outline" : "default"} data-testid={`button-enter-${exp.id}`}>
                {isAdmin ? "查看任务" : isDone ? "查看结果" : "开始标注"}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderReviewGroupCard = (group: ReviewGroup) => {
    const { experiment: exp, tasks, completedCount } = group;
    const pct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
    const isDone = completedCount >= tasks.length && tasks.length > 0;
    const cfg = PRIORITY_CONFIG[exp.priority ?? "P2"] ?? PRIORITY_CONFIG.P2;

    return (
      <Card
        key={exp.id}
        className={`cursor-pointer hover-elevate transition-shadow border-l-4 border-l-amber-400 ${isDone ? "opacity-75" : ""}`}
        onClick={() => setLocation(`/review-tasks?exp=${exp.id}`)}
        data-testid={`card-review-exp-${exp.id}`}
      >
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  <ShieldCheck className="w-3 h-3" />复核任务
                </span>
                <PriorityBadge priority={exp.priority} />
                {isDone && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                    <CheckCircle className="w-3 h-3" />已完成
                  </span>
                )}
                {exp.code && (
                  <span className="text-xs text-muted-foreground font-mono flex items-center gap-0.5">
                    <Hash className="w-3 h-3" />{exp.code}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-foreground text-base mb-1 truncate">
                {exp.name}
              </h3>
              {exp.description && (
                <p className="text-xs text-muted-foreground mb-2 truncate">{exp.description}</p>
              )}
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  共 <span className="font-semibold text-foreground">{tasks.length}</span> 条复核数据
                </span>
                <span className="text-xs text-muted-foreground">
                  已完成 <span className={`font-semibold ${isDone ? "text-green-600" : "text-amber-600"}`}>{completedCount}</span> 条
                </span>
                <DeadlineBadge deadline={exp.deadline} />
              </div>
              <div className="mt-3 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isDone ? "bg-green-500" : "bg-amber-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{pct}% 已复核</p>
            </div>
            <div className="flex-shrink-0 mt-1">
              <Button size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-600" variant="default" data-testid={`button-review-exp-${exp.id}`}>
                {isDone ? "查看结果" : "开始复核"}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const totalAnnotationTasks = items.reduce((s, i) => s + i.totalTasks, 0);
  const totalReviewTasks = reviewTasks.length;

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          {isAdmin ? <Eye className="w-8 h-8 text-primary" /> : <ClipboardList className="w-8 h-8 text-primary" />}
          {isAdmin ? "所有标注实验" : "我的任务"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin
            ? "以管理员身份查看全部实验任务，可进入任意实验进行查看或标注。"
            : `你好，${user?.username}！以下是分配给你的标注任务和复核任务。`}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as "annotation" | "review")} className="space-y-6">
        <TabsList className="h-10">
          <TabsTrigger value="annotation" className="gap-2 px-5" data-testid="tab-annotation">
            <ClipboardList className="w-4 h-4" />
            标注任务
            {items.length > 0 && (
              <span className="ml-1 text-xs bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-semibold">
                {items.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="review" className="gap-2 px-5" data-testid="tab-review">
            <ShieldCheck className="w-4 h-4" />
            复核任务
            {reviewGroups.length > 0 && (
              <span className="ml-1 text-xs bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-semibold">
                {reviewGroups.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="annotation" className="space-y-0">
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "待完成实验", value: pending.length, icon: AlertCircle, color: "text-amber-500" },
              { label: "已完成实验", value: done.length, icon: CheckCircle, color: "text-green-500" },
              { label: "总数据条数", value: totalAnnotationTasks, icon: ClipboardList, color: "text-primary" },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  </div>
                  <stat.icon className={`w-6 h-6 ${stat.color} opacity-60`} />
                </CardContent>
              </Card>
            ))}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
                <p className="text-lg font-medium text-foreground">暂无分配的实验任务</p>
                <p className="text-muted-foreground text-sm mt-1">请等待管理员分配标注任务。</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pending.length > 0 && (
                <>
                  <h2 className="text-base font-semibold text-foreground">待完成（{pending.length}）</h2>
                  <div className="space-y-3">{pending.map(renderAnnotationCard)}</div>
                </>
              )}
              {done.length > 0 && (
                <>
                  <h2 className="text-base font-semibold text-foreground mt-6">已完成（{done.length}）</h2>
                  <div className="space-y-3">{done.map(renderAnnotationCard)}</div>
                </>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="review" className="space-y-0">
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "待复核实验", value: reviewGroups.filter(g => g.completedCount < g.tasks.length).length, icon: AlertCircle, color: "text-amber-500" },
              { label: "已完成实验", value: reviewGroups.filter(g => g.completedCount >= g.tasks.length && g.tasks.length > 0).length, icon: CheckCircle, color: "text-green-500" },
              { label: "总复核条数", value: totalReviewTasks, icon: ShieldCheck, color: "text-amber-600" },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  </div>
                  <stat.icon className={`w-6 h-6 ${stat.color} opacity-60`} />
                </CardContent>
              </Card>
            ))}
          </div>

          {reviewLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 w-full" />)}
            </div>
          ) : reviewGroups.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-60" />
                <p className="text-lg font-medium text-foreground">暂无待复核任务</p>
                <p className="text-muted-foreground text-sm mt-1">系统会在符合条件的任务完成初标后自动分配复核任务给你。</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-foreground">复核实验列表（{reviewGroups.length}）</h2>
              <div className="space-y-3">{reviewGroups.map(renderReviewGroupCard)}</div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
