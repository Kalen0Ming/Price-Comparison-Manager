import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/hooks/use-auth";
import {
  ArrowLeft, Save, CheckCircle, Tag, ShoppingCart,
  ArrowUpDown, Equal, ArrowUp, ArrowDown, AlertCircle, ExternalLink, X, ZoomIn, Clock, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import type { Task, Experiment, Annotation, AnnotationTemplate, AnnotationField, DisplayField } from "@shared/schema";

const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|bmp|avif)(\?.*)?$/i;
const IMAGE_CDN = /^https?:\/\/[^/]*(alicdn\.com|img\.alicdn|gw\.alicdn|img\d+\.alicdn|img-s-msn|picasso|sinaimg\.cn|qpic\.cn|bdimg\.com|mmbiz\.qpic|cdn\.shopify|imgur\.com|i\.imgur)/i;

function isUrl(val: string): boolean {
  return /^https?:\/\//i.test(val);
}

function isImageUrl(val: string): boolean {
  if (!isUrl(val)) return false;
  if (IMAGE_EXTS.test(val.split("?")[0])) return true;
  return IMAGE_CDN.test(val);
}

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      data-testid="lightbox-overlay"
    >
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/80 hover:text-white transition-colors"
          data-testid="button-close-lightbox"
        >
          <X className="w-7 h-7" />
        </button>
        <img
          src={src}
          alt="放大图片"
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2 right-2 text-xs text-white/60 hover:text-white flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />在新标签打开
        </a>
      </div>
    </div>
  );
}

function SmartValue({ value }: { value: unknown }) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const str = String(value ?? "");
  if (!str || str === "—") return <span className="font-medium text-muted-foreground">—</span>;

  if (isImageUrl(str)) {
    return (
      <>
        {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
        <div className="flex flex-col gap-1.5">
          <div
            className="relative group inline-block cursor-zoom-in"
            onClick={() => setLightboxSrc(str)}
            data-testid="img-field-thumb"
          >
            <img
              src={str}
              alt=""
              className="max-h-36 max-w-full rounded-md border border-border object-contain bg-muted/30 transition-opacity group-hover:opacity-90"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="w-6 h-6 text-white drop-shadow-md" />
            </div>
          </div>
          <a href={str} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline break-all flex items-center gap-1">
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            <span className="truncate max-w-48">{str}</span>
          </a>
        </div>
      </>
    );
  }

  if (isUrl(str)) {
    return (
      <a
        href={str}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline underline-offset-2 hover:opacity-80 transition-opacity break-all flex items-start gap-1"
        data-testid="link-field-url"
      >
        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
        <span>{str}</span>
      </a>
    );
  }

  return <span className="font-medium text-foreground break-all">{str}</span>;
}

type TaskDetail = Task & {
  experiment: Experiment | null;
  template: AnnotationTemplate | null;
  existingAnnotation: Annotation | null;
};

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
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all cursor-pointer ${colorMap[color]}`}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function DataDisplayCard({ data, displayFields }: { data: Record<string, unknown>; displayFields?: DisplayField[] }) {
  if (displayFields && displayFields.length > 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            源数据
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {displayFields.map((f) => (
            <div key={f.key} className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground min-w-24 shrink-0 mt-0.5">{f.label}：</span>
              <SmartValue value={data[f.key] ?? "—"} />
            </div>
          ))}
          {Object.entries(data).filter(([k]) => !displayFields.some(f => f.key === k)).length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer select-none">查看其他字段</summary>
              <div className="mt-2 space-y-2">
                {Object.entries(data).filter(([k]) => !displayFields.some(f => f.key === k)).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs">
                    <span className="text-muted-foreground font-mono shrink-0">{k}：</span>
                    <SmartValue value={v} />
                  </div>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>
    );
  }

  // Default: try to show product A/B layout
  const hasSide = (side: "A" | "B") => Object.keys(data).some(k => k.toLowerCase().includes(side.toLowerCase()) || k.includes(`product${side}`));
  if (hasSide("A") || hasSide("B")) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProductCard label="A" data={data} side="A" />
        <ProductCard label="B" data={data} side="B" />
      </div>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">源数据</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex gap-2 text-sm">
            <span className="text-muted-foreground font-mono shrink-0 min-w-24 mt-0.5">{k}：</span>
            <SmartValue value={v ?? "—"} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ProductCard({ label, data, side }: { label: string; data: Record<string, unknown>; side: "A" | "B" }) {
  const borderColor = side === "A" ? "border-t-blue-500" : "border-t-amber-500";
  const badgeColor = side === "A" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700";
  const nameKey = `product${side}_name`;
  const priceKey = `product${side}_price`;
  const sourceKey = `product${side}_source`;
  const urlKey = `product${side}_url`;
  const name = String(data[nameKey] || data["name"] || "—");
  const price = String(data[priceKey] || data["price"] || "—");
  const source = String(data[sourceKey] || data["source"] || "—");
  const url = String(data[urlKey] || "");
  const shownKeys = [nameKey, priceKey, sourceKey, urlKey];
  const otherFields = Object.entries(data).filter(([k]) => k.toLowerCase().includes(side.toLowerCase()) && !shownKeys.includes(k));
  return (
    <Card className={`border-t-4 ${borderColor} h-full`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold mr-2 ${badgeColor}`}>商品 {label}</span>
          </CardTitle>
          {source !== "—" && <Badge variant="outline" className="text-xs"><ShoppingCart className="w-3 h-3 mr-1" />{source}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">商品名称</p>
          <p className="font-medium text-foreground leading-snug" data-testid={`text-product-${side}-name`}>{name}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">价格</p>
          <p className="text-2xl font-bold text-foreground" data-testid={`text-product-${side}-price`}>{price !== "—" ? `¥${price}` : "—"}</p>
        </div>
        {otherFields.map(([key, val]) => (
          <div key={key}>
            <p className="text-xs text-muted-foreground mb-0.5">{key.replace(new RegExp(`product${side}_`, "i"), "")}</p>
            <SmartValue value={val} />
          </div>
        ))}
        {url && url !== "—" && <SmartValue value={url} />}
      </CardContent>
    </Card>
  );
}

// --- Dynamic annotation form for template fields ---
function DynamicAnnotationForm({
  annotationFields,
  result,
  onChange,
}: {
  annotationFields: AnnotationField[];
  result: Record<string, unknown>;
  onChange: (r: Record<string, unknown>) => void;
}) {
  const PRESET_COLORS: Record<string, "green" | "red" | "amber" | "blue" | "default"> = {
    yes: "green", true: "green", correct: "green",
    no: "red", false: "red", incorrect: "red", wrong: "red",
    uncertain: "amber", unknown: "default",
  };

  return (
    <div className="space-y-6">
      {annotationFields.map((field, fi) => (
        <div key={field.key}>
          {fi > 0 && <Separator className="mb-6" />}
          <p className="text-sm font-semibold text-foreground mb-3">
            {field.required && <span className="text-primary mr-1">*</span>}
            {field.label}
          </p>
          {field.type === "text" ? (
            <Input
              value={String(result[field.key] ?? "")}
              onChange={(e) => onChange({ ...result, [field.key]: e.target.value })}
              placeholder={`请输入${field.label}...`}
              data-testid={`input-field-${field.key}`}
            />
          ) : (
            <div className="flex gap-3 flex-wrap">
              {(field.options ?? []).map((opt) => (
                <OptionButton
                  key={opt}
                  selected={result[field.key] === opt}
                  onClick={() => onChange({ ...result, [field.key]: opt })}
                  color={PRESET_COLORS[opt] ?? "default"}
                  testId={`option-${field.key}-${opt}`}
                >
                  {opt}
                </OptionButton>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Default hardcoded form (price comparison) ---
function DefaultAnnotationForm({
  result,
  onChange,
}: {
  result: Record<string, unknown>;
  onChange: (r: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">
          <span className="text-primary mr-1">*</span>
          商品 A 和商品 B 是否为同款商品？
        </p>
        <div className="flex gap-3">
          <OptionButton selected={result.is_same_product === "yes"} onClick={() => onChange({ ...result, is_same_product: "yes" })} color="green" testId="option-same-yes">✓ 是同款</OptionButton>
          <OptionButton selected={result.is_same_product === "no"} onClick={() => onChange({ ...result, is_same_product: "no" })} color="red" testId="option-same-no">✗ 非同款</OptionButton>
          <OptionButton selected={result.is_same_product === "uncertain"} onClick={() => onChange({ ...result, is_same_product: "uncertain" })} color="amber" testId="option-same-uncertain">? 不确定</OptionButton>
        </div>
      </div>
      <Separator />
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">
          <span className="text-primary mr-1">*</span>
          价格对比（A 相对于 B）
        </p>
        <div className="flex gap-3">
          <OptionButton selected={result.price_comparison === "A>B"} onClick={() => onChange({ ...result, price_comparison: "A>B" })} color="red" testId="option-price-a-higher"><div className="flex items-center justify-center gap-1.5"><ArrowUp className="w-4 h-4" />A 更贵</div></OptionButton>
          <OptionButton selected={result.price_comparison === "A<B"} onClick={() => onChange({ ...result, price_comparison: "A<B" })} color="green" testId="option-price-b-higher"><div className="flex items-center justify-center gap-1.5"><ArrowDown className="w-4 h-4" />A 更便宜</div></OptionButton>
          <OptionButton selected={result.price_comparison === "A=B"} onClick={() => onChange({ ...result, price_comparison: "A=B" })} color="blue" testId="option-price-equal"><div className="flex items-center justify-center gap-1.5"><Equal className="w-4 h-4" />价格相同</div></OptionButton>
          <OptionButton selected={result.price_comparison === "unknown"} onClick={() => onChange({ ...result, price_comparison: "unknown" })} color="default" testId="option-price-unknown">无法判断</OptionButton>
        </div>
      </div>
      <Separator />
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">质量/规格对比（可选）</p>
        <p className="text-xs text-muted-foreground mb-3">基于可见信息判断，A 的质量/规格相对于 B</p>
        <div className="flex gap-3">
          {(["A>B", "A<B", "A=B", "unknown"] as const).map((opt) => {
            const labels: Record<string, string> = { "A>B": "A 更好", "A<B": "A 更差", "A=B": "相同", "unknown": "无法判断" };
            const colors: Record<string, "green" | "red" | "blue" | "default"> = { "A>B": "green", "A<B": "red", "A=B": "blue", "unknown": "default" };
            return (
              <OptionButton key={opt} selected={result.quality_comparison === opt} onClick={() => onChange({ ...result, quality_comparison: opt })} color={colors[opt]} testId={`option-quality-${opt.replace(">","gt").replace("<","lt").replace("=","eq")}`}>{labels[opt]}</OptionButton>
            );
          })}
        </div>
      </div>
      <Separator />
      <div>
        <p className="text-sm font-semibold text-foreground mb-2">备注（可选）</p>
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="记录标注过程中的问题或特殊情况..."
          value={String(result.notes || "")}
          onChange={(e) => onChange({ ...result, notes: e.target.value })}
          data-testid="textarea-notes"
        />
      </div>
    </div>
  );
}

function DeadlineCountdown({ deadline }: { deadline: Date }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const diffMs = deadline.getTime() - now.getTime();
  const isPast = diffMs <= 0;
  const absDiff = Math.abs(diffMs);

  const totalSecs = Math.floor(absDiff / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  let countdownText: string;
  let colorCls: string;
  let showAlert = false;

  if (isPast) {
    countdownText = `已超期 ${days > 0 ? `${days} 天 ` : ""}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    colorCls = "text-red-700 bg-red-50 border border-red-200";
    showAlert = true;
  } else if (diffMs < 86400_000) {
    countdownText = `还剩 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    colorCls = "text-red-600 font-semibold";
    showAlert = true;
  } else if (diffMs < 3 * 86400_000) {
    countdownText = `还剩 ${days} 天 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    colorCls = "text-amber-600";
  } else {
    countdownText = `还剩 ${days} 天 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    colorCls = "text-muted-foreground";
  }

  return (
    <div className={`flex items-center gap-2 mt-1.5 text-xs px-2 py-1 rounded w-fit ${isPast ? colorCls : ""}`}>
      {showAlert && !isPast
        ? <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
        : showAlert
        ? <AlertTriangle className="w-3.5 h-3.5 text-red-700 shrink-0" />
        : <Clock className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
      <span className="text-muted-foreground">截止时间：{format(deadline, "yyyy-MM-dd HH:mm")}</span>
      <span className={`ml-1 ${isPast ? "" : colorCls}`}>{countdownText}</span>
    </div>
  );
}

export default function AnnotationWorkspace() {
  const { id } = useParams<{ id: string }>();
  const taskId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = getCurrentUser();

  const [result, setResult] = useState<Record<string, unknown>>({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDraft, setIsDraft] = useState(false);

  const { data: task, isLoading } = useQuery<TaskDetail>({
    queryKey: ["/api/tasks", taskId],
    queryFn: async () => {
      const r = await fetch(`/api/tasks/${taskId}`);
      if (!r.ok) throw new Error("Task not found");
      return r.json();
    },
  });

  useEffect(() => {
    if (task?.existingAnnotation) {
      setResult(task.existingAnnotation.result as Record<string, unknown>);
      setIsDraft(task.existingAnnotation.type === "draft");
    }
  }, [task?.existingAnnotation]);

  const saveMutation = useMutation({
    mutationFn: async (type: "draft" | "initial") => {
      const res = await fetch("/api/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, userId: user?.id, result, type }),
      });
      if (!res.ok) throw new Error("保存失败");
      return { type };
    },
    onSuccess: ({ type }) => {
      setLastSaved(new Date());
      setIsDraft(type === "draft");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks", user?.id] });
      if (type === "initial") {
        toast({ title: "标注已提交", description: "结果已成功保存到系统。" });
        setLocation("/my-tasks");
      } else {
        toast({ title: "暂存成功", description: "标注进度已保存，可随时继续。" });
      }
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "保存失败", description: err.message });
    },
  });

  const template = task?.template ?? null;
  const annotationFields: AnnotationField[] = template ? (template.annotationFields as AnnotationField[]) : [];
  const displayFields: DisplayField[] = template ? (template.displayFields as DisplayField[]) : [];

  // Completeness check
  const isComplete = annotationFields.length > 0
    ? annotationFields.filter(f => f.required).every(f => result[f.key] !== undefined && result[f.key] !== "")
    : (result.is_same_product !== undefined && result.price_comparison !== undefined);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 gap-6"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
          <Skeleton className="h-48" />
        </div>
      </DashboardLayout>
    );
  }

  if (!task) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <p className="text-lg font-medium">任务不存在</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/my-tasks")}>返回我的任务</Button>
        </div>
      </DashboardLayout>
    );
  }

  const data = task.originalData as Record<string, unknown>;
  const isAnnotated = task.status === "annotated";

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground mb-3" onClick={() => setLocation("/my-tasks")}>
            <ArrowLeft className="w-4 h-4" />
            返回任务列表
          </Button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">标注工作台</h1>
            <Badge variant="outline" className="text-xs">任务 #{task.id}</Badge>
            {task.experiment && <Badge variant="secondary" className="text-xs">{task.experiment.name}</Badge>}
            {template && <Badge variant="outline" className="text-xs border-primary/30 text-primary">模板：{template.name}</Badge>}
            {isAnnotated && <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckCircle className="w-3 h-3" /> 已完成</span>}
            {isDraft && <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700"><Save className="w-3 h-3" /> 草稿</span>}
          </div>
          {task.experiment?.deadline && <DeadlineCountdown deadline={new Date(task.experiment.deadline)} />}
          {lastSaved && <p className="text-xs text-muted-foreground mt-1">最后保存：{lastSaved.toLocaleTimeString("zh-CN")}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => saveMutation.mutate("draft")} disabled={saveMutation.isPending} data-testid="button-save-draft">
            <Save className="w-4 h-4" />暂存
          </Button>
          <Button className="gap-2" onClick={() => saveMutation.mutate("initial")} disabled={!isComplete || saveMutation.isPending} data-testid="button-submit-annotation">
            <CheckCircle className="w-4 h-4" />{isAnnotated ? "更新标注" : "提交标注"}
          </Button>
        </div>
      </div>

      {/* Data display: single card or 2-col for product comparison */}
      {template ? (
        <div className="mb-6">
          <DataDisplayCard data={data} displayFields={displayFields} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <ProductCard label="A" data={data} side="A" />
          <ProductCard label="B" data={data} side="B" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Tag className="w-5 h-5 text-primary" />
            标注选项
            {!isComplete && <span className="text-xs font-normal text-muted-foreground ml-1">（请填写全部必填项以提交）</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {annotationFields.length > 0 ? (
            <DynamicAnnotationForm
              annotationFields={annotationFields}
              result={result}
              onChange={setResult}
            />
          ) : (
            <DefaultAnnotationForm result={result} onChange={setResult} />
          )}

          {Object.keys(result).length > 0 && (
            <div className="bg-muted/40 rounded-lg p-4 text-xs space-y-1 mt-4">
              <p className="font-medium text-muted-foreground mb-2 uppercase tracking-wide">当前标注结果</p>
              {Object.entries(result).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => (
                <p key={k}>{k}：<span className="font-medium">{String(v)}</span></p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
