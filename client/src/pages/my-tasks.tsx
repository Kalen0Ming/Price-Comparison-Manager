import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/hooks/use-auth";
import { ClipboardList, ChevronRight, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import type { Task, Experiment } from "@shared/schema";

type TaskWithExperiment = Task & { experiment: Experiment | null };

function TaskStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: "待标注", className: "bg-amber-100 text-amber-700" },
    assigned: { label: "待标注", className: "bg-amber-100 text-amber-700" },
    annotated: { label: "已完成", className: "bg-green-100 text-green-700" },
    needs_review: { label: "需复核", className: "bg-red-100 text-red-700" },
  };
  const c = config[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.className}`}>
      {c.label}
    </span>
  );
}

export default function MyTasks() {
  const user = getCurrentUser();
  const [, setLocation] = useLocation();

  const { data: tasks = [], isLoading } = useQuery<TaskWithExperiment[]>({
    queryKey: ["/api/my-tasks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const res = await fetch(`/api/my-tasks?userId=${user.id}`);
      return res.json();
    },
    enabled: !!user,
  });

  const pendingTasks = tasks.filter(t => t.status !== "annotated");
  const completedTasks = tasks.filter(t => t.status === "annotated");

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-primary" />
          我的任务
        </h1>
        <p className="text-muted-foreground mt-1">
          你好，{user?.username}！以下是分配给你的标注任务。
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "待完成", value: pendingTasks.length, icon: AlertCircle, color: "text-amber-500" },
          { label: "已完成", value: completedTasks.length, icon: CheckCircle, color: "text-green-500" },
          { label: "总计", value: tasks.length, icon: ClipboardList, color: "text-primary" },
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

      {/* Task List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground mb-4">待完成任务</h2>
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : pendingTasks.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-60" />
              <p className="text-lg font-medium text-foreground">所有任务已完成！</p>
              <p className="text-muted-foreground text-sm mt-1">你已完成全部分配的标注任务，请等待新任务分配。</p>
            </CardContent>
          </Card>
        ) : (
          pendingTasks.map((task) => {
            const data = task.originalData as Record<string, unknown>;
            const productA = data.productA_name || data.product_a_name || Object.values(data)[0];
            const productB = data.productB_name || data.product_b_name || Object.values(data)[1];
            const deadline = task.experiment?.deadline;

            return (
              <Card
                key={task.id}
                className="cursor-pointer hover-elevate transition-shadow"
                onClick={() => setLocation(`/annotation/${task.id}`)}
                data-testid={`card-task-${task.id}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <TaskStatusBadge status={task.status} />
                        {task.experiment && (
                          <Badge variant="outline" className="text-xs">
                            {task.experiment.name}
                          </Badge>
                        )}
                        {deadline && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            截止 {format(new Date(deadline), "MM-dd HH:mm")}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground mb-0.5">商品 A</p>
                          <p className="text-sm font-medium truncate">{String(productA || "—")}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground mb-0.5">商品 B</p>
                          <p className="text-sm font-medium truncate">{String(productB || "—")}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button size="sm" className="gap-1.5" data-testid={`button-annotate-${task.id}`}>
                        开始标注
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}

        {completedTasks.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-foreground mb-4 mt-8">已完成任务</h2>
            {completedTasks.map((task) => {
              const data = task.originalData as Record<string, unknown>;
              const productA = data.productA_name || data.product_a_name || Object.values(data)[0];
              const productB = data.productB_name || data.product_b_name || Object.values(data)[1];
              return (
                <Card key={task.id} className="opacity-70" data-testid={`card-done-task-${task.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <TaskStatusBadge status={task.status} />
                          {task.experiment && (
                            <Badge variant="outline" className="text-xs">{task.experiment.name}</Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div><p className="text-xs text-muted-foreground">商品 A</p><p className="text-sm truncate">{String(productA || "—")}</p></div>
                          <div><p className="text-xs text-muted-foreground">商品 B</p><p className="text-sm truncate">{String(productB || "—")}</p></div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLocation(`/annotation/${task.id}`)}
                        data-testid={`button-view-annotation-${task.id}`}
                      >
                        查看结果
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
