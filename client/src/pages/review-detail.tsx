import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/hooks/use-auth";
import {
  ArrowLeft, ShieldCheck, CheckCircle, AlertTriangle, Equal,
  ArrowUp, ArrowDown, Save, Gavel, ChevronRight,
} from "lucide-react";
import type { Task, Experiment, Annotation } from "@shared/schema";

type AnnotationResult = {
  is_same_product?: "yes" | "no" | "uncertain";
  price_comparison?: "A>B" | "A<B" | "A=B" | "unknown";
  quality_comparison?: "A>B" | "A<B" | "A=B" | "unknown";
  notes?: string;
};

type TaskWithFull = Task & {
  experiment: Experiment | null;
  initialAnnotation: Annotation | null;
  reviewAnnotation: Annotation | null;
  allAnnotations: Annotation[];
  existingAnnotation: Annotation | null;
};

const FIELD_LABELS: Record<string, string> = {
  is_same_product: "是否同款",
  price_comparison: "价格对比",
  quality_comparison: "质量对比",
  notes: "备注",
};

const RESULT_LABELS: Record<string, Record<string, string>> = {
  is_same_product: { yes: "是同款", no: "非同款", uncertain: "不确定" },
  price_comparison: { "A>B": "A更贵", "A<B": "A更便宜", "A=B": "价格相同", unknown: "无法判断" },
  quality_comparison: { "A>B": "A更好", "A<B": "A更差", "A=B": "相同", unknown: "无法判断" },
};

function formatResultValue(field: string, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  return RESULT_LABELS[field]?.[String(value)] ?? String(value);
}

function ResultField({ field, value, otherValue, highlight }: {
  field: string; value: unknown; otherValue?: unknown; highlight?: boolean;
}) {
  const isConflict = highlight && otherValue !== undefined && value !== otherValue;
  return (
    <div className={`flex items-center justify-between py-2.5 px-3 rounded-lg text-sm ${isConflict ? "bg-red-50 border border-red-200" : "bg-muted/40"}`}>
      <span className="text-muted-foreground font-medium">{FIELD_LABELS[field] || field}</span>
      <div className="flex items-center gap-2">
        {isConflict && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
        <span className={`font-semibold ${isConflict ? "text-red-700" : "text-foreground"}`}>
          {formatResultValue(field, value)}
        </span>
      </div>
    </div>
  );
}

function OptionButton({
  selected, onClick, children, color = "default", testId,
}: {
  selected: boolean; onClick: () => void; children: React.ReactNode;
  color?: "green" | "red" | "amber" | "blue" | "default"; testId?: string;
}) {
  const colorMap = {
    green: selected ? "border-green-500 bg-green-50 text-green-700 ring-2 ring-green-300" : "border-border hover:border-green-300",
    red: selected ? "border-red-500 bg-red-50 text-red-700 ring-2 ring-red-300" : "border-border hover:border-red-300",
    amber: selected ? "border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-300" : "border-border hover:border-amber-300",
    blue: selected ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-300" : "border-border hover:border-blue-300",
    default: selected ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/30" : "border-border",
  };
  return (
    <button type="button" onClick={onClick} data-testid={testId}
      className={`flex-1 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all cursor-pointer ${colorMap[color]}`}>
      {children}
    </button>
  );
}

// Modes for admin view
type AdminMode = "comparison" | "adjudicate";

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const taskId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = getCurrentUser();

  const isAdmin = user?.role === "admin" || user?.role === "reviewer";
  const isReviewer = isAdmin;

  const { data: task, isLoading } = useQuery<TaskWithFull>({
    queryKey: ["/api/tasks", taskId],
    queryFn: async () => {
      const r = await fetch(`/api/tasks/${taskId}`);
      if (!r.ok) throw new Error("Task not found");
      return r.json();
    },
  });

  // For review annotation submission (reviewer filling in their result)
  const [reviewResult, setReviewResult] = useState<AnnotationResult>({});
  const [adminMode, setAdminMode] = useState<AdminMode>("comparison");
  const [customResult, setCustomResult] = useState<AnnotationResult>({});

  const isReviewComplete = task?.status === "needs_review" && !!task.reviewAnnotation;

  // Pre-fill reviewer result if already submitted
  useEffect(() => {
    if (task?.reviewAnnotation) {
      setReviewResult(task.reviewAnnotation.result as AnnotationResult);
    }
    if (task?.finalResult) {
      setCustomResult(task.finalResult as AnnotationResult);
    }
  }, [task?.reviewAnnotation, task?.finalResult]);

  // Submit review annotation
  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          userId: user?.id,
          result: reviewResult,
          type: "review",
        }),
      });
      if (!res.ok) throw new Error("提交失败");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "复核结果已提交", description: "你的复核标注已保存，等待管理员裁定。" });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId] });
      queryClient.invalidateQueries({ queryKey: ["/api/review-tasks", user?.id] });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "提交失败", description: err.message });
    },
  });

  // Adjudicate (admin final decision)
  const adjudicateMutation = useMutation({
    mutationFn: async (source: "initial" | "review" | "custom") => {
      let finalResult: AnnotationResult;
      if (source === "initial") finalResult = (task?.initialAnnotation?.result as AnnotationResult) || {};
      else if (source === "review") finalResult = (task?.reviewAnnotation?.result as AnnotationResult) || {};
      else finalResult = customResult;

      const res = await fetch(`/api/tasks/${taskId}/adjudicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalResult }),
      });
      if (!res.ok) throw new Error("裁定失败");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "裁定完成", description: "任务已标记为最终完成状态。" });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId] });
      queryClient.invalidateQueries({ queryKey: ["/api/experiments"] });
      setLocation(-1 as any);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "裁定失败", description: err.message });
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 gap-6"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!task) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-lg text-muted-foreground">任务不存在</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation(-1 as any)}>返回</Button>
        </div>
      </DashboardLayout>
    );
  }

  const data = task.originalData as Record<string, unknown>;
  const initialResult = task.initialAnnotation?.result as AnnotationResult | null;
  const reviewResult_ = task.reviewAnnotation?.result as AnnotationResult | null;
  const isCompleted = task.status === "completed";

  // Detect conflicting fields between initial and review
  const conflictFields = new Set<string>();
  if (initialResult && reviewResult_) {
    const keys = ["is_same_product", "price_comparison", "quality_comparison"];
    for (const k of keys) {
      const a = initialResult[k as keyof AnnotationResult];
      const b = reviewResult_[k as keyof AnnotationResult];
      if (a !== undefined && b !== undefined && a !== b) conflictFields.add(k);
    }
  }
  const hasConflict = conflictFields.size > 0;

  const isReviewSubmitComplete = reviewResult.is_same_product !== undefined && reviewResult.price_comparison !== undefined;
  const alreadyReviewedByMe = task.reviewAnnotation?.userId === user?.id;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground mb-3"
            onClick={() => setLocation(isAdmin ? `/experiments/${task.experimentId}` : "/review-tasks")}>
            <ArrowLeft className="w-4 h-4" />
            {isAdmin ? "返回实验详情" : "返回复核列表"}
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {isCompleted ? "已完成任务" : "复核工作台"}
            </h1>
            <Badge variant="outline" className="text-xs">任务 #{task.id}</Badge>
            {task.experiment && <Badge variant="secondary" className="text-xs">{task.experiment.name}</Badge>}
            {isCompleted && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <CheckCircle className="w-3 h-3" /> 已完成
              </span>
            )}
            {!isCompleted && hasConflict && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                <AlertTriangle className="w-3 h-3" /> 存在分歧
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Product Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {(["A", "B"] as const).map((side) => {
          const borderColor = side === "A" ? "border-t-blue-500" : "border-t-amber-500";
          const nameKey = `product${side}_name`;
          const priceKey = `product${side}_price`;
          const sourceKey = `product${side}_source`;
          return (
            <Card key={side} className={`border-t-4 ${borderColor}`}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${side === "A" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                    商品 {side}
                  </span>
                  {data[sourceKey] && <span className="text-xs text-muted-foreground">{String(data[sourceKey])}</span>}
                </div>
                <p className="font-semibold text-foreground">{String(data[nameKey] || "—")}</p>
                {data[priceKey] && (
                  <p className="text-2xl font-bold text-foreground mt-2">¥{data[priceKey]}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* --- REVIEWER SECTION: Submit review annotation --- */}
      {!isAdmin && !isCompleted && (
        <Card className="mb-6 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-5 h-5 text-amber-500" />
              复核标注
              {alreadyReviewedByMe && (
                <span className="text-xs font-normal text-green-600 ml-1">（已提交，可修改）</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Show initial result for reference */}
            {initialResult && (
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">初标结果（参考）</p>
                <div className="space-y-1">
                  {Object.entries(initialResult).filter(([k]) => k !== "notes").map(([k, v]) => (
                    <p key={k} className="text-sm">
                      <span className="text-blue-600">{FIELD_LABELS[k] || k}：</span>
                      <span className="font-medium">{formatResultValue(k, v)}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Q1 */}
            <div>
              <p className="text-sm font-semibold mb-2"><span className="text-primary mr-1">*</span>是否同款</p>
              <div className="flex gap-2">
                <OptionButton selected={reviewResult.is_same_product === "yes"} onClick={() => setReviewResult(r => ({ ...r, is_same_product: "yes" }))} color="green" testId="review-same-yes">✓ 是同款</OptionButton>
                <OptionButton selected={reviewResult.is_same_product === "no"} onClick={() => setReviewResult(r => ({ ...r, is_same_product: "no" }))} color="red" testId="review-same-no">✗ 非同款</OptionButton>
                <OptionButton selected={reviewResult.is_same_product === "uncertain"} onClick={() => setReviewResult(r => ({ ...r, is_same_product: "uncertain" }))} color="amber" testId="review-same-uncertain">? 不确定</OptionButton>
              </div>
            </div>

            {/* Q2 */}
            <div>
              <p className="text-sm font-semibold mb-2"><span className="text-primary mr-1">*</span>价格对比</p>
              <div className="flex gap-2">
                <OptionButton selected={reviewResult.price_comparison === "A>B"} onClick={() => setReviewResult(r => ({ ...r, price_comparison: "A>B" }))} color="red" testId="review-price-a-higher"><ArrowUp className="w-3.5 h-3.5 mx-auto" />A 更贵</OptionButton>
                <OptionButton selected={reviewResult.price_comparison === "A<B"} onClick={() => setReviewResult(r => ({ ...r, price_comparison: "A<B" }))} color="green" testId="review-price-b-higher"><ArrowDown className="w-3.5 h-3.5 mx-auto" />A 更便宜</OptionButton>
                <OptionButton selected={reviewResult.price_comparison === "A=B"} onClick={() => setReviewResult(r => ({ ...r, price_comparison: "A=B" }))} color="blue" testId="review-price-equal"><Equal className="w-3.5 h-3.5 mx-auto" />相同</OptionButton>
                <OptionButton selected={reviewResult.price_comparison === "unknown"} onClick={() => setReviewResult(r => ({ ...r, price_comparison: "unknown" }))} testId="review-price-unknown">无法判断</OptionButton>
              </div>
            </div>

            {/* Q3 */}
            <div>
              <p className="text-sm font-semibold mb-2 text-muted-foreground">质量对比（可选）</p>
              <div className="flex gap-2">
                {(["A>B", "A<B", "A=B", "unknown"] as const).map((opt) => {
                  const labels = { "A>B": "A更好", "A<B": "A更差", "A=B": "相同", unknown: "无法判断" };
                  const colors: Record<string, any> = { "A>B": "green", "A<B": "red", "A=B": "blue", unknown: "default" };
                  return (
                    <OptionButton key={opt} selected={reviewResult.quality_comparison === opt}
                      onClick={() => setReviewResult(r => ({ ...r, quality_comparison: opt }))}
                      color={colors[opt]}>{labels[opt]}</OptionButton>
                  );
                })}
              </div>
            </div>

            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-16 focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="复核备注（可选）..."
              value={reviewResult.notes || ""}
              onChange={(e) => setReviewResult(r => ({ ...r, notes: e.target.value }))}
            />

            <Button className="w-full gap-2 bg-amber-500 hover:bg-amber-600" disabled={!isReviewSubmitComplete || submitReviewMutation.isPending}
              onClick={() => submitReviewMutation.mutate()} data-testid="button-submit-review">
              <ShieldCheck className="w-4 h-4" />
              {submitReviewMutation.isPending ? "提交中..." : alreadyReviewedByMe ? "更新复核结果" : "提交复核结果"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* --- ADMIN SECTION: Comparison and Adjudication --- */}
      {(isAdmin || isCompleted) && (initialResult || reviewResult_) && (
        <div className="space-y-6">
          {/* Side-by-side comparison */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gavel className="w-5 h-5 text-primary" />
                  {isCompleted ? "标注结果对比" : "初标 vs 复标 对比"}
                </CardTitle>
                {hasConflict && (
                  <span className="text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {conflictFields.size} 个字段存在分歧
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Initial */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold px-2 py-1 rounded bg-blue-100 text-blue-700">初标结果</span>
                    {!initialResult && <span className="text-xs text-muted-foreground">尚未标注</span>}
                  </div>
                  {initialResult ? (
                    <div className="space-y-2">
                      {["is_same_product", "price_comparison", "quality_comparison", "notes"].map(field => (
                        initialResult[field as keyof AnnotationResult] !== undefined && (
                          <ResultField key={field} field={field} value={initialResult[field as keyof AnnotationResult]}
                            otherValue={reviewResult_?.[field as keyof AnnotationResult]}
                            highlight={conflictFields.has(field)} />
                        )
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded-lg">暂无初标结果</p>
                  )}
                </div>

                {/* Review */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold px-2 py-1 rounded bg-amber-100 text-amber-700">复标结果</span>
                    {!reviewResult_ && <span className="text-xs text-muted-foreground">尚未复核</span>}
                  </div>
                  {reviewResult_ ? (
                    <div className="space-y-2">
                      {["is_same_product", "price_comparison", "quality_comparison", "notes"].map(field => (
                        reviewResult_[field as keyof AnnotationResult] !== undefined && (
                          <ResultField key={field} field={field} value={reviewResult_[field as keyof AnnotationResult]}
                            otherValue={initialResult?.[field as keyof AnnotationResult]}
                            highlight={conflictFields.has(field)} />
                        )
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded-lg">
                      {task.status === "needs_review" ? "复标员尚未提交" : "暂无复标结果"}
                    </p>
                  )}
                </div>
              </div>

              {/* Final Result (if completed) */}
              {isCompleted && task.finalResult && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" /> 最终裁定结果
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(task.finalResult as Record<string, unknown>)
                        .filter(([, v]) => v !== undefined && v !== "")
                        .map(([k, v]) => (
                          <div key={k} className="flex justify-between items-center px-3 py-2 bg-green-50 rounded-lg text-sm border border-green-200">
                            <span className="text-green-700 font-medium">{FIELD_LABELS[k] || k}</span>
                            <span className="font-bold text-green-800">{formatResultValue(k, v)}</span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Adjudication Panel (only if not yet completed and admin) */}
          {isAdmin && !isCompleted && task.status === "needs_review" && (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Gavel className="w-5 h-5 text-primary" />
                  最终裁定
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quick adopt buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button variant="outline" className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                    disabled={!initialResult || adjudicateMutation.isPending}
                    onClick={() => adjudicateMutation.mutate("initial")}
                    data-testid="button-adopt-initial">
                    <CheckCircle className="w-4 h-4" />
                    采纳初标结果
                  </Button>
                  <Button variant="outline" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                    disabled={!reviewResult_ || adjudicateMutation.isPending}
                    onClick={() => adjudicateMutation.mutate("review")}
                    data-testid="button-adopt-review">
                    <ShieldCheck className="w-4 h-4" />
                    采纳复标结果
                  </Button>
                </div>

                <Separator />

                {/* Custom adjudication */}
                <div>
                  <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Gavel className="w-4 h-4 text-primary" />
                    自定义裁定结果
                  </p>

                  {/* Q1 */}
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground font-medium mb-2">是否同款</p>
                    <div className="flex gap-2">
                      <OptionButton selected={customResult.is_same_product === "yes"} onClick={() => setCustomResult(r => ({ ...r, is_same_product: "yes" }))} color="green" testId="custom-same-yes">是同款</OptionButton>
                      <OptionButton selected={customResult.is_same_product === "no"} onClick={() => setCustomResult(r => ({ ...r, is_same_product: "no" }))} color="red" testId="custom-same-no">非同款</OptionButton>
                      <OptionButton selected={customResult.is_same_product === "uncertain"} onClick={() => setCustomResult(r => ({ ...r, is_same_product: "uncertain" }))} color="amber" testId="custom-same-uncertain">不确定</OptionButton>
                    </div>
                  </div>

                  {/* Q2 */}
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground font-medium mb-2">价格对比</p>
                    <div className="flex gap-2">
                      <OptionButton selected={customResult.price_comparison === "A>B"} onClick={() => setCustomResult(r => ({ ...r, price_comparison: "A>B" }))} color="red" testId="custom-price-a">A更贵</OptionButton>
                      <OptionButton selected={customResult.price_comparison === "A<B"} onClick={() => setCustomResult(r => ({ ...r, price_comparison: "A<B" }))} color="green" testId="custom-price-b">A更便宜</OptionButton>
                      <OptionButton selected={customResult.price_comparison === "A=B"} onClick={() => setCustomResult(r => ({ ...r, price_comparison: "A=B" }))} color="blue" testId="custom-price-eq">相同</OptionButton>
                      <OptionButton selected={customResult.price_comparison === "unknown"} onClick={() => setCustomResult(r => ({ ...r, price_comparison: "unknown" }))} testId="custom-price-unk">无法判断</OptionButton>
                    </div>
                  </div>

                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-14 focus:outline-none focus:ring-2 focus:ring-ring mb-3"
                    placeholder="裁定备注（可选）..."
                    value={customResult.notes || ""}
                    onChange={(e) => setCustomResult(r => ({ ...r, notes: e.target.value }))}
                  />

                  <Button className="w-full gap-2"
                    disabled={!customResult.is_same_product || !customResult.price_comparison || adjudicateMutation.isPending}
                    onClick={() => adjudicateMutation.mutate("custom")}
                    data-testid="button-adjudicate-custom">
                    <Gavel className="w-4 h-4" />
                    {adjudicateMutation.isPending ? "裁定中..." : "提交自定义裁定"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Reviewer: show existing review result if completed */}
      {!isAdmin && isCompleted && (
        <Card className="border-green-200">
          <CardContent className="py-8 text-center">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-500" />
            <p className="font-medium text-foreground">此任务已完成裁定</p>
            <p className="text-sm text-muted-foreground mt-1">管理员已对初标和复标结果进行了最终裁定。</p>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
