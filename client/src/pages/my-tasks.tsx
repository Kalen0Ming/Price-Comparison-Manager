import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/hooks/use-auth";
import { ClipboardList, ChevronRight, Clock, CheckCircle, AlertCircle, AlertTriangle, Eye, Hash } from "lucide-react";
import { format, differenceInHours, differenceInDays } from "date-fns";
import type { Experiment, AnnotationTemplate } from "@shared/schema";

type ExperimentItem = {
  experiment: Experiment;
  template: AnnotationTemplate | null;
  totalTasks: number;
  annotatedTasks: number;
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
  if (!deadline) return null;
  const d = new Date(deadline);
  const hoursLeft = differenceInHours(d, new Date());
  const daysLeft = differenceInDays(d, new Date());
  if (hoursLeft < 0) return (
    <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" />已逾期 {format(d, "MM-dd")}
    </span>
  );
  if (hoursLeft < 24) return (
    <span className="text-xs text-red-500 font-medium flex items-center gap-1">
      <AlertCircle className="w-3 h-3" />紧急·剩 {hoursLeft} 小时
    </span>
  );
  if (daysLeft < 3) return (
    <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
      <Clock className="w-3 h-3" />截止 {format(d, "MM-dd HH:mm")}（剩 {daysLeft} 天）
    </span>
  );
  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      <Clock className="w-3 h-3" />截止 {format(d, "MM-dd HH:mm")}
    </span>
  );
}

export default function MyTasks() {
  const user = getCurrentUser();
  const [, setLocation] = useLocation();
  const isAdmin = user?.role === "admin";

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

  const pending = items.filter(i => i.annotatedTasks < i.totalTasks);
  const done = items.filter(i => i.annotatedTasks >= i.totalTasks && i.totalTasks > 0);

  const renderCard = (item: ExperimentItem) => {
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
                {item.template && (
                  <span className="text-xs text-muted-foreground">模板：{item.template.name}</span>
                )}
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

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          {isAdmin ? <Eye className="w-8 h-8 text-primary" /> : <ClipboardList className="w-8 h-8 text-primary" />}
          {isAdmin ? "所有标注实验" : "我的标注任务"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin
            ? "以管理员身份查看全部实验任务，可进入任意实验进行查看或标注。"
            : `你好，${user?.username}！以下是分配给你的标注实验任务，按优先级排序。`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "待完成实验", value: pending.length, icon: AlertCircle, color: "text-amber-500" },
          { label: "已完成实验", value: done.length, icon: CheckCircle, color: "text-green-500" },
          { label: "总数据条数", value: items.reduce((s, i) => s + i.totalTasks, 0), icon: ClipboardList, color: "text-primary" },
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
              <div className="space-y-3">
                {pending.map(renderCard)}
              </div>
            </>
          )}
          {done.length > 0 && (
            <>
              <h2 className="text-base font-semibold text-foreground mt-6">已完成（{done.length}）</h2>
              <div className="space-y-3">
                {done.map(renderCard)}
              </div>
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
