import { useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import * as z from "zod";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useExperiments, useCreateExperiment } from "@/hooks/use-experiments";
import { Plus, Beaker, Calendar, Settings2, LayoutTemplate, Hash, Flag } from "lucide-react";
import type { AnnotationTemplate } from "@shared/schema";

const PRIORITY_OPTS = [
  { value: "P1", label: "P1 — 紧急", color: "text-red-600" },
  { value: "P2", label: "P2 — 普通", color: "text-amber-600" },
  { value: "P3", label: "P3 — 低", color: "text-slate-500" },
];

const formSchema = z.object({
  name: z.string().min(1, "实验名称不能为空"),
  code: z.string().optional(),
  priority: z.enum(["P1", "P2", "P3"]).default("P2"),
  description: z.string().optional(),
  deadline: z.string().optional(),
  enableReview: z.boolean().default(false),
  reviewRatio: z.coerce.number().min(0).max(100).default(0),
  templateId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  in_progress: "进行中",
  completed: "已完成",
  archived: "已归档",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  archived: "bg-gray-100 text-gray-600",
};

export default function Experiments() {
  const { data: experiments = [], isLoading } = useExperiments();
  const createExperiment = useCreateExperiment();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [, setLocation] = useLocation();

  const { data: templates = [] } = useQuery<AnnotationTemplate[]>({
    queryKey: ["/api/templates"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      priority: "P2",
      description: "",
      deadline: "",
      enableReview: false,
      reviewRatio: 0,
      templateId: "",
    }
  });

  const onSubmit = (data: FormValues) => {
    createExperiment.mutate({
      ...data,
      code: data.code || undefined,
      deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      templateId: data.templateId ? Number(data.templateId) : null,
      status: "draft"
    } as any, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
      }
    });
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Beaker className="w-8 h-8 text-primary" />
            实验管理
          </h1>
          <p className="text-muted-foreground mt-1">管理标注项目和配置。</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 premium-shadow hover:shadow-lg hover:-translate-y-0.5 transition-all" data-testid="button-create-experiment">
              <Plus className="w-4 h-4" />
              新建实验
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] border-border/50 premium-shadow">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">新建实验</DialogTitle>
              <DialogDescription>
                配置新的价格比对标注实验。
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">实验名称 *</Label>
                <Input id="name" {...form.register("name")} placeholder="例：2024年Q3电子产品价格比对" data-testid="input-experiment-name" />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code" className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-muted-foreground" />
                    实验编码
                  </Label>
                  <Input id="code" {...form.register("code")} placeholder="留空自动生成" data-testid="input-experiment-code" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority" className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-muted-foreground" />
                    优先级
                  </Label>
                  <Select
                    value={form.watch("priority")}
                    onValueChange={(val) => form.setValue("priority", val as "P1" | "P2" | "P3")}
                  >
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className={opt.color}>{opt.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">实验描述</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder="为标注员提供说明和背景信息..."
                  className="resize-none h-20"
                  data-testid="textarea-description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="templateId" className="flex items-center gap-2">
                  <LayoutTemplate className="w-4 h-4 text-muted-foreground" />
                  标注模板
                </Label>
                <Select
                  value={form.watch("templateId") || "__none__"}
                  onValueChange={(val) => form.setValue("templateId", val === "__none__" ? "" : val)}
                >
                  <SelectTrigger data-testid="select-template">
                    <SelectValue placeholder="不使用模板（默认价格比对）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— 不使用模板（默认价格比对）—</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deadline" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    截止时间
                  </Label>
                  <Input id="deadline" type="datetime-local" {...form.register("deadline")} data-testid="input-deadline" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reviewRatio" className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-muted-foreground" />
                    复核抽样比例 (%)
                  </Label>
                  <Input id="reviewRatio" type="number" min="0" max="100" {...form.register("reviewRatio")} data-testid="input-review-ratio" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-slate-50">
                <div className="space-y-0.5">
                  <Label className="text-base">启用双人复核</Label>
                  <p className="text-sm text-muted-foreground">按比例抽取任务进行第二次复核</p>
                </div>
                <Switch
                  checked={form.watch("enableReview")}
                  onCheckedChange={(checked) => form.setValue("enableReview", checked)}
                  data-testid="switch-enable-review"
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={createExperiment.isPending} data-testid="button-submit-experiment">
                  {createExperiment.isPending ? "创建中..." : "创建实验"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="premium-shadow border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="font-semibold text-slate-600">优先级</TableHead>
                <TableHead className="font-semibold text-slate-600">实验名称 / 编码</TableHead>
                <TableHead className="font-semibold text-slate-600">状态</TableHead>
                <TableHead className="font-semibold text-slate-600">复核配置</TableHead>
                <TableHead className="font-semibold text-slate-600">截止时间</TableHead>
                <TableHead className="text-right font-semibold text-slate-600">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">加载中...</TableCell>
                </TableRow>
              ) : experiments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">暂无实验，点击"新建实验"开始。</TableCell>
                </TableRow>
              ) : (
                experiments.map((exp) => {
                  const pCfg = exp.priority === "P1"
                    ? { bg: "bg-red-100", text: "text-red-700", label: "P1" }
                    : exp.priority === "P3"
                    ? { bg: "bg-slate-100", text: "text-slate-600", label: "P3" }
                    : { bg: "bg-amber-100", text: "text-amber-700", label: "P2" };
                  return (
                  <TableRow key={exp.id} className="hover:bg-slate-50/50 transition-colors" data-testid={`row-experiment-${exp.id}`}>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${pCfg.bg} ${pCfg.text}`}>
                        {pCfg.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground">{exp.name}</p>
                      {(exp as any).code && (
                        <p className="text-xs font-mono text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Hash className="w-3 h-3" />{(exp as any).code}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[exp.status] ?? 'bg-slate-100 text-slate-800'}`}>
                        {STATUS_LABELS[exp.status] ?? exp.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {exp.enableReview ? (
                        <span className="text-sm text-slate-600">抽样 {exp.reviewRatio}%</span>
                      ) : (
                        <span className="text-sm text-slate-400">未启用</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {exp.deadline ? format(new Date(exp.deadline), 'yyyy-MM-dd HH:mm') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary"
                        onClick={() => setLocation(`/experiments/${exp.id}`)}
                        data-testid={`button-view-experiment-${exp.id}`}
                      >
                        查看详情
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
