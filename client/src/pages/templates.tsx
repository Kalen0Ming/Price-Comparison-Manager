import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { LayoutTemplate, Plus, Trash2, PlusCircle, Star, Eye } from "lucide-react";
import type { AnnotationTemplate, AnnotationField, DisplayField } from "@shared/schema";

function FieldEditor({
  fields,
  onChange,
  type,
}: {
  fields: DisplayField[] | AnnotationField[];
  onChange: (f: any[]) => void;
  type: "display" | "annotation";
}) {
  const addField = () => {
    if (type === "display") {
      onChange([...fields, { key: "", label: "" }]);
    } else {
      onChange([...(fields as AnnotationField[]), { key: "", label: "", type: "select", options: ["yes", "no"], required: true, isJudgment: false }]);
    }
  };

  const removeField = (i: number) => {
    const next = [...fields];
    next.splice(i, 1);
    onChange(next);
  };

  const updateField = (i: number, updates: Partial<AnnotationField | DisplayField>) => {
    const next = [...fields] as any[];
    next[i] = { ...next[i], ...updates };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {fields.map((field, i) => (
        <div key={i} className="border rounded-lg p-3 space-y-2 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">字段键名</Label>
                <Input
                  className="h-8 text-xs font-mono mt-1"
                  value={field.key}
                  onChange={(e) => updateField(i, { key: e.target.value })}
                  placeholder="my_field_key"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">显示标签</Label>
                <Input
                  className="h-8 text-xs mt-1"
                  value={field.label}
                  onChange={(e) => updateField(i, { label: e.target.value })}
                  placeholder="字段显示名称"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-destructive hover:bg-destructive/10 flex-shrink-0"
              onClick={() => removeField(i)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {type === "annotation" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">输入类型</Label>
                  <Select
                    value={(field as AnnotationField).type}
                    onValueChange={(v) => updateField(i, { type: v as any })}
                  >
                    <SelectTrigger className="h-8 text-xs mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="select">下拉选择</SelectItem>
                      <SelectItem value="radio">单选按钮</SelectItem>
                      <SelectItem value="text">文本输入</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={(field as AnnotationField).required ?? false}
                      onCheckedChange={(v) => updateField(i, { required: v })}
                      id={`required-${i}`}
                    />
                    <Label htmlFor={`required-${i}`} className="text-xs cursor-pointer">必填</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={(field as AnnotationField).isJudgment ?? false}
                      onCheckedChange={(v) => updateField(i, { isJudgment: v })}
                      id={`judgment-${i}`}
                    />
                    <Label htmlFor={`judgment-${i}`} className="text-xs cursor-pointer text-amber-600 font-medium flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      结果字段
                    </Label>
                  </div>
                </div>
              </div>

              {((field as AnnotationField).type === "select" || (field as AnnotationField).type === "radio") && (
                <div>
                  <Label className="text-xs text-muted-foreground">选项值（用逗号分隔）</Label>
                  <Input
                    className="h-8 text-xs mt-1"
                    value={((field as AnnotationField).options ?? []).join(",")}
                    onChange={(e) => updateField(i, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                    placeholder="yes,no,uncertain"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" className="w-full gap-2 text-muted-foreground" onClick={addField}>
        <PlusCircle className="w-4 h-4" />
        {type === "display" ? "添加展示字段" : "添加标注字段"}
      </Button>
    </div>
  );
}

function TemplateFormDialog({
  template,
  onClose,
}: {
  template?: AnnotationTemplate;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [displayFields, setDisplayFields] = useState<DisplayField[]>(
    (template?.displayFields as DisplayField[]) ?? []
  );
  const [annotationFields, setAnnotationFields] = useState<AnnotationField[]>(
    (template?.annotationFields as AnnotationField[]) ?? [
      { key: "is_correct", label: "是否正确", type: "select", options: ["yes", "no", "uncertain"], required: true, isJudgment: true },
    ]
  );

  const judgmentField = annotationFields.find(f => f.isJudgment)?.key ?? "";

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("模板名称不能为空");
      const judg = annotationFields.find(f => f.isJudgment);
      if (!judg) throw new Error("请至少设置一个「结果字段」（点击字段的星形开关）");
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        displayFields,
        annotationFields,
        judgmentField: judg.key,
      };
      const url = template ? `/api/templates/${template.id}` : "/api/templates";
      const method = template ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "保存失败");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: template ? "模板已更新" : "模板已创建" });
      onClose();
    },
    onError: (e: Error) => {
      toast({ variant: "destructive", title: "保存失败", description: e.message });
    },
  });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>模板名称 *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="例：商品真假判断模板" data-testid="input-template-name" />
      </div>

      <div className="space-y-2">
        <Label>模板描述</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="说明此模板的用途..." className="resize-none h-16" />
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          <Label className="text-base font-semibold">展示字段</Label>
        </div>
        <p className="text-xs text-muted-foreground">导入数据时，这些字段会展示给标注员用于参考判断。</p>
        <FieldEditor fields={displayFields} onChange={setDisplayFields} type="display" />
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          <Label className="text-base font-semibold">标注字段</Label>
        </div>
        <p className="text-xs text-muted-foreground">标注员需要填写的字段。请将其中一个字段设为「结果字段」用于统计。</p>
        <FieldEditor fields={annotationFields} onChange={setAnnotationFields} type="annotation" />
      </div>

      {judgmentField && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <span className="font-medium text-amber-800">结果字段：</span>
          <code className="ml-1 text-amber-700">{judgmentField}</code>
          <span className="text-amber-600 ml-1">（将用于最终标注结果统计）</span>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>取消</Button>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-template">
          {saveMutation.isPending ? "保存中..." : "保存模板"}
        </Button>
      </div>
    </div>
  );
}

export default function Templates() {
  const { data: templates = [], isLoading } = useQuery<AnnotationTemplate[]>({
    queryKey: ["/api/templates"],
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<AnnotationTemplate | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "模板已删除" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "删除失败" });
    },
  });

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <LayoutTemplate className="w-8 h-8 text-primary" />
            标注模板
          </h1>
          <p className="text-muted-foreground mt-1">配置标注字段模板，创建实验时可选择对应模板。</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-template">
              <Plus className="w-4 h-4" />
              新建模板
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>新建标注模板</DialogTitle>
            </DialogHeader>
            <TemplateFormDialog onClose={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">加载中...</div>
      ) : templates.length === 0 ? (
        <Card className="premium-shadow border-border/50">
          <CardContent className="py-16 text-center">
            <LayoutTemplate className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-lg font-medium text-foreground mb-2">暂无标注模板</p>
            <p className="text-sm text-muted-foreground mb-6">创建模板后，可在新建实验时选择，让标注表单更灵活。</p>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              新建第一个模板
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => {
            const annFields = (t.annotationFields as AnnotationField[]) ?? [];
            const dispFields = (t.displayFields as DisplayField[]) ?? [];
            const judgmentFieldObj = annFields.find(f => f.isJudgment || f.key === t.judgmentField);
            return (
              <Card key={t.id} className="premium-shadow border-border/50 flex flex-col" data-testid={`card-template-${t.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{t.name}</CardTitle>
                      {t.description && (
                        <CardDescription className="text-xs mt-1 line-clamp-2">{t.description}</CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">展示字段 ({dispFields.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {dispFields.slice(0, 4).map((f) => (
                        <Badge key={f.key} variant="secondary" className="text-xs">{f.label}</Badge>
                      ))}
                      {dispFields.length > 4 && <Badge variant="outline" className="text-xs">+{dispFields.length - 4}</Badge>}
                      {dispFields.length === 0 && <span className="text-xs text-muted-foreground">（无）</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">标注字段 ({annFields.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {annFields.map((f) => (
                        <Badge
                          key={f.key}
                          variant={f.isJudgment || f.key === t.judgmentField ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {f.isJudgment || f.key === t.judgmentField ? <Star className="w-3 h-3 mr-1 inline" /> : null}
                          {f.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {judgmentFieldObj && (
                    <div className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                      结果字段：<code>{judgmentFieldObj.key}</code>
                    </div>
                  )}
                </CardContent>
                <div className="px-6 pb-4 flex gap-2 border-t pt-4 mt-auto">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setEditTemplate(t)}
                        data-testid={`button-edit-template-${t.id}`}
                      >
                        编辑
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>编辑模板</DialogTitle>
                      </DialogHeader>
                      {editTemplate && editTemplate.id === t.id && (
                        <TemplateFormDialog
                          template={editTemplate}
                          onClose={() => setEditTemplate(null)}
                        />
                      )}
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm(`确认删除模板"${t.name}"？`)) {
                        deleteMutation.mutate(t.id);
                      }
                    }}
                    data-testid={`button-delete-template-${t.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
