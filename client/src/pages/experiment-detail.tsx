import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BarChart2, ClipboardList, Clock, CheckCircle, AlertCircle, Database } from "lucide-react";
import { format } from "date-fns";
import type { Experiment, ExperimentStats } from "@shared/schema";

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
    pending: "bg-amber-100 text-amber-700",
    annotated: "bg-green-100 text-green-700",
    needs_review: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = { pending: "待标注", annotated: "已标注", needs_review: "需复核" };
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

export default function ExperimentDetail() {
  const { id } = useParams<{ id: string }>();
  const expId = Number(id);

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
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{experiment?.name}</h1>
            {experiment && <StatusBadge status={experiment.status} />}
          </div>
        )}
        {experiment?.description && (
          <p className="text-muted-foreground mt-1">{experiment.description}</p>
        )}
        {experiment?.deadline && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            截止日期：{format(new Date(experiment.deadline), "yyyy-MM-dd")}
          </p>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "总任务数", value: stats?.totalTasks, icon: Database, color: "text-primary" },
          { label: "待标注", value: stats?.pendingTasks, icon: ClipboardList, color: "text-amber-500" },
          { label: "已标注", value: stats?.annotatedTasks, icon: CheckCircle, color: "text-green-500" },
          { label: "需复核", value: stats?.needsReviewTasks, icon: AlertCircle, color: "text-red-500" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className={`text-3xl font-bold ${stat.color}`}>{stat.value ?? 0}</p>
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
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>数据字段</TableHead>
                      <TableHead>创建时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.sampleTasks.map((task, i) => {
                      const data = task.originalData as Record<string, unknown>;
                      const fieldEntries = Object.entries(data).slice(0, 3);
                      return (
                        <TableRow key={task.id} data-testid={`row-task-${task.id}`}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          <TableCell><TaskStatusBadge status={task.status} /></TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              {fieldEntries.map(([k, v]) => (
                                <p key={k} className="text-xs">
                                  <span className="text-muted-foreground">{k}:</span>{" "}
                                  <span className="font-medium">{String(v)}</span>
                                </p>
                              ))}
                              {Object.keys(data).length > 3 && (
                                <p className="text-xs text-muted-foreground">+{Object.keys(data).length - 3} 个字段</p>
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
