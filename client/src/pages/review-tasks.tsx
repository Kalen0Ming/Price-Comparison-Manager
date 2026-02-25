import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentUser } from "@/hooks/use-auth";
import { ShieldCheck, ChevronRight, AlertTriangle, CheckCircle, Clock, Eye } from "lucide-react";
import { format } from "date-fns";
import type { Task, Experiment, Annotation } from "@shared/schema";

type ReviewTask = Task & {
  experiment: Experiment | null;
  initialAnnotation: Annotation | null;
};

const RESULT_LABELS: Record<string, Record<string, string>> = {
  is_same_product: { yes: "是同款", no: "非同款", uncertain: "不确定" },
  price_comparison: { "A>B": "A更贵", "A<B": "A更便宜", "A=B": "价格相同", unknown: "无法判断" },
  quality_comparison: { "A>B": "A更好", "A<B": "A更差", "A=B": "相同", unknown: "无法判断" },
};

function ResultChip({ field, value }: { field: string; value: unknown }) {
  const label = RESULT_LABELS[field]?.[String(value)] || String(value);
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs">
      {label}
    </span>
  );
}

export default function ReviewTasks() {
  const user = getCurrentUser();
  const [, setLocation] = useLocation();

  const { data: tasks = [], isLoading } = useQuery<ReviewTask[]>({
    queryKey: ["/api/review-tasks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const res = await fetch(`/api/review-tasks?userId=${user.id}`);
      return res.json();
    },
    enabled: !!user,
  });

  return (
    <DashboardLayout>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">复核任务</h1>
            <p className="text-muted-foreground text-sm">以下任务已完成初标，需要你进行复核标注</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "待复核", value: tasks.length, icon: AlertTriangle, color: "text-amber-500" },
          { label: "今日完成", value: 0, icon: CheckCircle, color: "text-green-500" },
          { label: "总计", value: tasks.length, icon: Eye, color: "text-primary" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
              <s.icon className={`w-6 h-6 ${s.color} opacity-60`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-60" />
              <p className="text-lg font-medium text-foreground">暂无待复核任务</p>
              <p className="text-muted-foreground text-sm mt-1">系统会在符合条件的任务完成初标后自动分配复核任务给你。</p>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task) => {
            const data = task.originalData as Record<string, unknown>;
            const productA = String(data.productA_name || data.product_a_name || Object.values(data)[0] || "—");
            const productB = String(data.productB_name || data.product_b_name || Object.values(data)[1] || "—");
            const deadline = task.experiment?.deadline;
            const initResult = task.initialAnnotation?.result as Record<string, unknown> | null;

            return (
              <Card
                key={task.id}
                className="cursor-pointer hover-elevate transition-shadow border-l-4 border-l-amber-400"
                onClick={() => setLocation(`/review/${task.id}`)}
                data-testid={`card-review-task-${task.id}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <ShieldCheck className="w-3 h-3" />
                          待复核
                        </span>
                        {task.experiment && (
                          <Badge variant="outline" className="text-xs">{task.experiment.name}</Badge>
                        )}
                        {deadline && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            截止 {format(new Date(deadline), "MM-dd")}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">任务 #{task.id}</span>
                      </div>

                      {/* Product Preview */}
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="bg-blue-50 rounded-lg p-3 min-w-0">
                          <p className="text-xs text-blue-600 font-medium mb-1">商品 A</p>
                          <p className="text-sm font-medium truncate">{productA}</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-3 min-w-0">
                          <p className="text-xs text-amber-600 font-medium mb-1">商品 B</p>
                          <p className="text-sm font-medium truncate">{productB}</p>
                        </div>
                      </div>

                      {/* Initial Annotation Preview */}
                      {initResult && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">初标结果：</span>
                          {Object.entries(initResult)
                            .filter(([k]) => k !== "notes")
                            .map(([k, v]) => (
                              <ResultChip key={k} field={k} value={v} />
                            ))
                          }
                        </div>
                      )}
                    </div>

                    <Button size="sm" className="gap-1.5 flex-shrink-0 bg-amber-500 hover:bg-amber-600" data-testid={`button-review-${task.id}`}>
                      开始复核
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </DashboardLayout>
  );
}
