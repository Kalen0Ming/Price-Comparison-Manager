import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Layers, Search, Calendar, Users, ClipboardList, Hash, Eye, Info,
} from "lucide-react";
import { format } from "date-fns";
import type { TaskBatch, Experiment, Task, Annotation, AnnotationTemplate } from "@shared/schema";

type BatchItem = TaskBatch & { experiment: Experiment | null };
type BatchResult = {
  batch: TaskBatch;
  experiment: Experiment | null;
  template: AnnotationTemplate | null;
  tasks: (Task & { annotation: Annotation | null; annotatorName: string | null })[];
};

type ExperimentResultStats = {
  totalTasks: number;
  completedTasks: number;
  annotatedTasks: number;
  reviewedCount: number;
  matchedCount: number;
  accuracy: number | null;
  completionRate: number;
};

const ASSIGN_TYPE_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  auto: { label: "自动分配", bg: "bg-blue-100", text: "text-blue-700" },
  manual: { label: "手动分配", bg: "bg-purple-100", text: "text-purple-700" },
};

function TaskStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "待分配", cls: "bg-slate-100 text-slate-700" },
    assigned: { label: "待标注", cls: "bg-amber-100 text-amber-700" },
    annotated: { label: "已标注", cls: "bg-green-100 text-green-700" },
    needs_review: { label: "待复核", cls: "bg-orange-100 text-orange-700" },
    completed: { label: "已完成", cls: "bg-emerald-100 text-emerald-700" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function AnnotationResultDisplay({ result, template }: {
  result: Record<string, unknown>;
  template: AnnotationTemplate | null;
}) {
  if (!result || Object.keys(result).length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const fields = (template?.annotationFields as Array<{ key: string; label: string }> | null) ?? [];
  return (
    <div className="flex gap-1.5 flex-wrap">
      {fields.length > 0 ? fields.map(f => (
        result[f.key] != null ? (
          <span key={f.key} className="text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5 font-medium">
            {String(result[f.key])}
          </span>
        ) : null
      )) : Object.entries(result).slice(0, 3).map(([k, v]) => (
        <span key={k} className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
          {k}: {String(v)}
        </span>
      ))}
    </div>
  );
}

function AccuracyRing({ value }: { value: number }) {
  const color = value >= 80 ? "text-emerald-600" : value >= 60 ? "text-amber-500" : "text-red-500";
  const barColor = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value}%</span>
    </div>
  );
}

function BatchResultSheet({ batchId, open, onClose }: { batchId: number | null; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery<BatchResult>({
    queryKey: ["/api/task-batches", batchId, "results"],
    queryFn: async () => {
      const res = await fetch(`/api/task-batches/${batchId}/results`);
      return res.json();
    },
    enabled: open && batchId !== null,
  });

  const { data: expStats } = useQuery<ExperimentResultStats>({
    queryKey: ["/api/experiments", data?.experiment?.id, "result-stats"],
    queryFn: async () => {
      const res = await fetch(`/api/experiments/${data!.experiment!.id}/result-stats`);
      return res.json();
    },
    enabled: !!data?.experiment?.id,
  });

  const tasks = data?.tasks ?? [];
  const annotated = tasks.filter(t =>
    t.annotation !== null || t.status === "annotated" || t.status === "needs_review" || t.status === "completed"
  ).length;
  const pct = tasks.length > 0 ? Math.round((annotated / tasks.length) * 100) : 0;

  const displayFields = (data?.template?.displayFields as Array<{ key: string; label: string }> | null) ?? [];
  const autoFields = displayFields.length > 0
    ? displayFields.slice(0, 3)
    : tasks.length > 0
      ? Object.keys(tasks[0].originalData as Record<string, unknown>).slice(0, 3).map(k => ({ key: k, label: k }))
      : [];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl w-full max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            批次标注结果
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 px-6 py-4">

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : !data ? (
          <p className="text-muted-foreground text-sm">无法加载批次数据</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">批次编码</p>
                <p className="font-mono font-semibold text-xs">{data.batch.code}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">所属实验</p>
                <p className="font-medium text-sm truncate">{data.experiment?.name ?? "—"}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">分配时间</p>
                <p className="font-medium text-xs">
                  {data.batch.createdAt ? format(new Date(data.batch.createdAt), "yyyy-MM-dd HH:mm") : "—"}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">批次完成进度</p>
                <p className="font-bold text-primary text-sm">{pct}%（{annotated}/{tasks.length}）</p>
              </div>
            </div>

            <div className="w-full bg-muted rounded-full h-2 overflow-hidden mb-5">
              <div
                className={`h-full rounded-full ${pct === 100 ? "bg-green-500" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            {expStats && (
              <div className="mb-5 rounded-xl border border-border bg-gradient-to-br from-slate-50 to-white p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">实验整体结果指标</p>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{expStats.totalTasks}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">实验总任务数</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-indigo-600">{expStats.annotatedTasks}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">已标注完成数</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">{expStats.completionRate}%</p>
                    <p className="text-xs text-muted-foreground mt-0.5">总体完成率</p>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium text-foreground">复核准确率</p>
                    <span className="text-xs text-muted-foreground">
                      {expStats.reviewedCount > 0 ? `${expStats.matchedCount}/${expStats.reviewedCount} 一致` : "暂无复核数据"}
                    </span>
                  </div>
                  {expStats.accuracy !== null ? (
                    <AccuracyRing value={expStats.accuracy} />
                  ) : (
                    <p className="text-xs text-muted-foreground">此实验未开启复核或尚无复核记录</p>
                  )}
                </div>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/60 border-b text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-left w-10">#</th>
                      <th className="px-3 py-2 text-left">状态</th>
                      {autoFields.map(f => (
                        <th key={f.key} className="px-3 py-2 text-left max-w-[140px]">{f.label || f.key}</th>
                      ))}
                      <th className="px-3 py-2 text-left min-w-[120px]">标注结果</th>
                      <th className="px-3 py-2 text-left">标注员</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task, idx) => {
                      const rowData = task.originalData as Record<string, unknown>;
                      const isAnnotated = task.annotation !== null ||
                        task.status === "annotated" || task.status === "needs_review" || task.status === "completed";
                      return (
                        <tr
                          key={task.id}
                          className={`border-b last:border-0 text-xs ${isAnnotated ? "bg-green-50/50 dark:bg-green-950/10" : ""}`}
                          data-testid={`row-batch-task-${task.id}`}
                        >
                          <td className="px-3 py-2 text-muted-foreground font-mono">{idx + 1}</td>
                          <td className="px-3 py-2"><TaskStatusBadge status={task.status} /></td>
                          {autoFields.map(f => (
                            <td key={f.key} className="px-3 py-2 max-w-[140px] overflow-hidden">
                              <span className="text-xs text-foreground truncate block" title={String(rowData[f.key] ?? "")}>
                                {String(rowData[f.key] ?? "—").slice(0, 35)}
                              </span>
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            {task.annotation?.result
                              ? <AnnotationResultDisplay
                                  result={task.annotation.result as Record<string, unknown>}
                                  template={data.template}
                                />
                              : <span className="text-xs text-muted-foreground">未标注</span>}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{task.annotatorName ?? "—"}</td>
                        </tr>
                      );
                    })}
                    {tasks.length === 0 && (
                      <tr>
                        <td colSpan={5 + autoFields.length} className="px-3 py-8 text-center text-muted-foreground text-xs">
                          无任务数据
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TaskBatchesPage() {
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: batches = [], isLoading } = useQuery<BatchItem[]>({
    queryKey: ["/api/task-batches", search, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await fetch(`/api/task-batches?${params.toString()}`);
      return res.json();
    },
  });

  const handleView = (batchId: number) => {
    setSelectedBatchId(batchId);
    setSheetOpen(true);
  };

  const totalTasks = batches.reduce((s, b) => s + b.taskCount, 0);
  const uniqueExps = new Set(batches.map(b => b.experimentId)).size;

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Layers className="w-8 h-8 text-primary" />
          实验结果列表
        </h1>
        <p className="text-muted-foreground mt-1">
          查看每次任务分配产生的批次记录，点击「查看结果」可查看该实验的完整标注情况与结果指标。
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "总批次数", value: batches.length, icon: Layers, color: "text-primary" },
          { label: "合计任务条数", value: totalTasks, icon: ClipboardList, color: "text-amber-500" },
          { label: "涉及实验数", value: uniqueExps, icon: Users, color: "text-green-500" },
        ].map(stat => (
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

      <Card className="mb-5">
        <CardContent className="py-4 px-5">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground mb-1 block">批次编码搜索</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="输入批次编码关键字…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9"
                  data-testid="input-batch-search"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1 block">
                <Calendar className="w-3 h-3" />开始日期
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="h-9 w-40"
                data-testid="input-start-date"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">结束日期</label>
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="h-9 w-40"
                data-testid="input-end-date"
              />
            </div>
            {(search || startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearch(""); setStartDate(""); setEndDate(""); }}
                className="h-9"
                data-testid="button-clear-filters"
              >
                清除筛选
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : batches.length === 0 ? (
            <div className="py-16 text-center">
              <Layers className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground font-medium">暂无分配批次记录</p>
              <p className="text-sm text-muted-foreground mt-1">
                {search || startDate || endDate
                  ? "当前筛选条件下无匹配批次，请尝试其他搜索条件。"
                  : "在实验详情页进行任务分配后，批次记录将在此自动生成。"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-semibold">批次编码</TableHead>
                  <TableHead className="font-semibold">所属实验</TableHead>
                  <TableHead className="font-semibold">分配方式</TableHead>
                  <TableHead className="font-semibold">任务数</TableHead>
                  <TableHead className="font-semibold">标注员数</TableHead>
                  <TableHead className="font-semibold">是否复核</TableHead>
                  <TableHead className="font-semibold">分配时间</TableHead>
                  <TableHead className="text-right font-semibold">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map(batch => {
                  const typeCfg = ASSIGN_TYPE_LABELS[batch.assignType] ?? ASSIGN_TYPE_LABELS.auto;
                  return (
                    <TableRow
                      key={batch.id}
                      className="hover:bg-muted/30 transition-colors"
                      data-testid={`row-batch-${batch.id}`}
                    >
                      <TableCell>
                        <span className="font-mono text-sm font-semibold flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          {batch.code}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-foreground">
                          {batch.experiment?.name ?? `实验 #${batch.experimentId}`}
                        </span>
                        {batch.experiment?.code && (
                          <span className="text-xs text-muted-foreground font-mono block">{batch.experiment.code}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${typeCfg.bg} ${typeCfg.text}`}>
                          {typeCfg.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-semibold text-foreground">{batch.taskCount}</span>
                        <span className="text-xs text-muted-foreground ml-1">条</span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          {batch.userCount} 人
                        </span>
                      </TableCell>
                      <TableCell>
                        {batch.reviewEnabled ? (
                          <span className="text-xs text-orange-600 font-medium">需复核</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">无需复核</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {batch.createdAt ? format(new Date(batch.createdAt), "yyyy-MM-dd HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => handleView(batch.id)}
                          data-testid={`button-view-batch-${batch.id}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          查看结果
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

      {batches.length > 0 && (
        <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            批次编码格式：<span className="font-mono font-medium">YYYYMMDD-{"{任务数}"}T-{"{人数}"}U-A/M-R/N</span>
            &emsp;A=自动分配，M=手动分配；R=需复核，N=无需复核
          </span>
        </div>
      )}

      <BatchResultSheet
        batchId={selectedBatchId}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </DashboardLayout>
  );
}
