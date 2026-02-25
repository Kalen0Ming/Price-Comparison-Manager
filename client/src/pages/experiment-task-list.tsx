import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getCurrentUser } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft, CheckCircle, Circle, Hash, Clock, AlertTriangle,
  Search, ChevronLeft as PrevIcon, ChevronRight as NextIcon,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import type { Task, AnnotationTemplate } from "@shared/schema";

type TaskWithAnnotation = Task & {
  annotation: { result: Record<string, unknown>; id: number; type: string } | null;
};
type PageData = {
  tasks: TaskWithAnnotation[];
  experiment: {
    id: number; name: string; code: string | null; priority: string | null;
    deadline: string | null; description: string | null; templateId: number | null;
  } | null;
  template: AnnotationTemplate | null;
};

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  P1: { label: "P1 紧急", bg: "bg-red-100", text: "text-red-700" },
  P2: { label: "P2 普通", bg: "bg-amber-100", text: "text-amber-700" },
  P3: { label: "P3 低", bg: "bg-slate-100", text: "text-slate-600" },
};

const PAGE_SIZE = 50;

function splitOptions(options: string[]): string[] {
  return options.flatMap(opt => opt.split(/[，,]/).map((s: string) => s.trim()).filter(Boolean));
}

function truncate(str: unknown, len = 40): string {
  const s = String(str ?? "");
  return s.length > len ? s.slice(0, len) + "…" : s;
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|avif)(\?.*)?$/i.test(url) ||
    /alicdn\.com|sinaimg\.cn|qpic\.cn|imgur\.com/.test(url);
}

function CellValue({ value }: { value: unknown }) {
  if (value == null || value === "") return <span className="text-muted-foreground text-xs">—</span>;
  const str = String(value);
  if (/^https?:\/\//.test(str)) {
    if (isImageUrl(str)) return (
      <a href={str} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs" title={str}>
        [图片]
      </a>
    );
    return (
      <a href={str} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs" title={str}>
        {truncate(str, 30)}
      </a>
    );
  }
  return <span className="text-xs text-foreground" title={str}>{truncate(str, 40)}</span>;
}

export default function ExperimentTaskList() {
  const { id: experimentId } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const user = getCurrentUser();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [optimisticAnnotations, setOptimisticAnnotations] = useState<Record<number, Record<string, string>>>({});

  const queryKey = ["/api/experiments", experimentId, "tasks-for-user", user?.id];
  const { data, isLoading } = useQuery<PageData>({
    queryKey,
    queryFn: async () => {
      if (!user) return { tasks: [], experiment: null, template: null };
      const url = isAdmin
        ? `/api/experiments/${experimentId}/tasks-for-user?all=true`
        : `/api/experiments/${experimentId}/tasks-for-user?userId=${user.id}`;
      const res = await fetch(url);
      return res.json();
    },
    enabled: !!user,
  });

  const annotateMutation = useMutation({
    mutationFn: (payload: { taskId: number; result: Record<string, unknown> }) =>
      apiRequest("POST", `/api/tasks/${payload.taskId}/annotate-inline`, { userId: user?.id, result: payload.result }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => toast({ title: "保存失败", variant: "destructive" }),
  });

  const { experiment: exp, template, tasks: allTasks = [] } = data ?? {};

  const annotationFields = useMemo(() => {
    if (!template?.annotationFields) return [];
    return template.annotationFields as Array<{ key: string; label: string; type: string; options?: string[] }>;
  }, [template]);

  const displayFieldDefs = useMemo(() => {
    if (!template?.displayFields) return [] as Array<{ key: string; label: string }>;
    return template.displayFields as Array<{ key: string; label: string }>;
  }, [template]);

  const autoDisplayFields = useMemo(() => {
    if (displayFieldDefs.length > 0) return displayFieldDefs;
    if (allTasks.length === 0) return [];
    const firstData = allTasks[0].originalData as Record<string, unknown>;
    return Object.keys(firstData).slice(0, 5).map(k => ({ key: k, label: k }));
  }, [displayFieldDefs, allTasks]);

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return allTasks;
    const q = search.toLowerCase();
    return allTasks.filter(t => {
      const data = t.originalData as Record<string, unknown>;
      return Object.values(data).some(v => String(v ?? "").toLowerCase().includes(q));
    });
  }, [allTasks, search]);

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / PAGE_SIZE));
  const pageTasks = filteredTasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const getAnnotationResult = (task: TaskWithAnnotation): Record<string, unknown> => {
    if (optimisticAnnotations[task.id]) return optimisticAnnotations[task.id];
    return (task.annotation?.result as Record<string, unknown>) ?? {};
  };

  const handleAnnotate = (task: TaskWithAnnotation, fieldName: string, value: string) => {
    const current = getAnnotationResult(task);
    const newResult = { ...current, [fieldName]: value };
    setOptimisticAnnotations(prev => ({ ...prev, [task.id]: newResult as Record<string, string> }));
    annotateMutation.mutate({ taskId: task.id, result: newResult });
  };

  const annotatedCount = allTasks.filter(t => {
    if (optimisticAnnotations[t.id]) return true;
    return t.annotation !== null || t.status === "annotated" || t.status === "needs_review" || t.status === "completed";
  }).length;

  const pct = allTasks.length > 0 ? Math.round((annotatedCount / allTasks.length) * 100) : 0;

  const priority = exp?.priority ?? "P2";
  const pCfg = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.P2;

  return (
    <DashboardLayout>
      <div className="mb-5">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/my-tasks")} className="mb-3 gap-2" data-testid="button-back">
          <ChevronLeft className="w-4 h-4" />返回实验列表
        </Button>

        {isLoading || !exp ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <div className="flex items-start justify-between flex-wrap gap-4 pb-4 border-b">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${pCfg.bg} ${pCfg.text}`}>{pCfg.label}</span>
                {exp.code && (
                  <span className="text-sm font-mono text-muted-foreground flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5" />{exp.code}
                  </span>
                )}
                {exp.deadline && (
                  <span className={`text-xs flex items-center gap-1 ${differenceInDays(new Date(exp.deadline), new Date()) < 2 ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
                    <Clock className="w-3.5 h-3.5" />截止 {format(new Date(exp.deadline), "yyyy-MM-dd")}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-experiment-name">{exp.name}</h1>
              {exp.description && <p className="text-sm text-muted-foreground mt-0.5">{exp.description}</p>}
            </div>

            <div className="text-right min-w-[160px]">
              <p className="text-3xl font-bold text-primary">{pct}%</p>
              <p className="text-sm text-muted-foreground">{annotatedCount} / {allTasks.length} 已标注</p>
              <div className="mt-2 w-full bg-muted rounded-full h-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-primary"}`}
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索数据内容…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9"
            data-testid="input-search"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{filteredTasks.length} 条记录</span>
          {totalPages > 1 && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <PrevIcon className="w-4 h-4" />
              </Button>
              <span className="text-xs">{page} / {totalPages}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <NextIcon className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : allTasks.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">暂无分配给你的任务数据</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 text-left font-semibold w-12 sticky left-0 bg-muted/60">#</th>
                  <th className="px-3 py-2.5 text-left font-medium w-16">状态</th>
                  {autoDisplayFields.map((f) => (
                    <th key={f.key} className="px-3 py-2.5 text-left font-medium min-w-[120px] max-w-[200px]">
                      {f.label || f.key}
                    </th>
                  ))}
                  {annotationFields.map((f) => (
                    <th key={f.key} className="px-3 py-2.5 text-left font-semibold text-foreground min-w-[160px]">
                      {f.label || f.key}
                    </th>
                  ))}
                  {annotationFields.length === 0 && (
                    <th className="px-3 py-2.5 text-left font-semibold text-foreground min-w-[160px]">标注</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pageTasks.map((task, idx) => {
                  const rowData = task.originalData as Record<string, unknown>;
                  const annResult = getAnnotationResult(task);
                  const isAnnotated = Object.keys(optimisticAnnotations[task.id] ?? {}).length > 0 ||
                    task.annotation !== null || task.status === "annotated" || task.status === "needs_review" || task.status === "completed";
                  const globalIdx = (page - 1) * PAGE_SIZE + idx + 1;

                  return (
                    <tr
                      key={task.id}
                      className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${isAnnotated ? "bg-green-50/50 dark:bg-green-950/10" : ""}`}
                      data-testid={`row-task-${task.id}`}
                    >
                      <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono sticky left-0 bg-inherit">
                        {globalIdx}
                      </td>
                      <td className="px-3 py-2.5">
                        {isAnnotated ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground" />
                        )}
                      </td>
                      {autoDisplayFields.map((f) => (
                        <td key={f.key} className="px-3 py-2.5 max-w-[200px] overflow-hidden">
                          <CellValue value={rowData[f.key]} />
                        </td>
                      ))}
                      {annotationFields.length > 0 ? annotationFields.map((field) => {
                        const currentVal = String(annResult[field.key] ?? "");
                        const options = field.options ? splitOptions(field.options) : [];
                        if (field.type === "select" || field.type === "radio" || options.length > 0) {
                          return (
                            <td key={field.key} className="px-3 py-2 whitespace-nowrap">
                              <div className="flex gap-1 flex-wrap">
                                {options.map((opt: string) => (
                                  <button
                                    key={opt}
                                    onClick={() => !isAdmin && handleAnnotate(task, field.key, opt)}
                                    disabled={isAdmin}
                                    data-testid={`button-option-${task.id}-${opt}`}
                                    className={`
                                      text-xs px-2.5 py-1 rounded-full border transition-all font-medium
                                      ${currentVal === opt
                                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                        : "bg-background text-foreground border-border hover:border-primary hover:text-primary"}
                                      ${isAdmin ? "cursor-default opacity-80" : "cursor-pointer"}
                                    `}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td key={field.key} className="px-3 py-2">
                            <input
                              type="text"
                              defaultValue={currentVal}
                              placeholder={`输入${field.label || field.key}…`}
                              disabled={isAdmin}
                              onBlur={(e) => {
                                if (!isAdmin && e.target.value !== currentVal) {
                                  handleAnnotate(task, field.key, e.target.value);
                                }
                              }}
                              className="text-xs w-full px-2 py-1 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                              data-testid={`input-annotation-${task.id}-${field.key}`}
                            />
                          </td>
                        );
                      }) : (
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-xs text-muted-foreground">无标注字段</Badge>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            上一页
          </Button>
          <span className="text-sm text-muted-foreground">第 {page} 页，共 {totalPages} 页</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            下一页
          </Button>
        </div>
      )}
    </DashboardLayout>
  );
}
