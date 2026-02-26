import { useState, useRef, useEffect } from "react";
import { useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, ArrowRight, CheckCircle, ChevronRight, RotateCcw, Info, Loader2 } from "lucide-react";
import type { Experiment, AnnotationTemplate, DisplayField } from "@shared/schema";

type Step = "upload" | "map" | "done";

interface ParseResult {
  columns: string[];
  preview: Record<string, string>[];
  totalRows: number;
  uploadId: string;
}

export default function ImportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const search = useSearch();

  const [step, setStep] = useState<Step>("upload");
  const [selectedExperimentId, setSelectedExperimentId] = useState<string>(() => {
    const params = new URLSearchParams(search);
    return params.get("experimentId") ?? "";
  });

  useEffect(() => {
    const params = new URLSearchParams(search);
    const expId = params.get("experimentId");
    if (expId) setSelectedExperimentId(expId);
  }, [search]);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const { data: experiments = [] } = useQuery<Experiment[]>({ queryKey: ["/api/experiments"] });
  const { data: templates = [] } = useQuery<AnnotationTemplate[]>({ queryKey: ["/api/templates"] });

  const selectedExperiment = experiments.find(e => String(e.id) === selectedExperimentId);
  const selectedTemplate = selectedExperiment?.templateId
    ? templates.find(t => t.id === selectedExperiment.templateId)
    : null;
  const displayFields: DisplayField[] = selectedTemplate
    ? (selectedTemplate.displayFields as DisplayField[])
    : [];

  const createTasksMutation = useMutation({
    mutationFn: async () => {
      if (!parseResult?.uploadId) throw new Error("请重新上传文件");
      const res = await fetch("/api/import/create-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experimentId: Number(selectedExperimentId),
          uploadId: parseResult.uploadId,
          mapping: displayFields.length > 0 ? mapping : {},
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "创建任务失败");
      }
      return res.json() as Promise<{ created: number }>;
    },
    onSuccess: (data) => {
      setCreatedCount(data.created);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "导入成功", description: `已创建 ${data.created} 条标注任务` });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "导入失败", description: err.message });
    },
  });

  const handleFileSelect = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/upload", { method: "POST", body: formData });
      if (!res.ok) { toast({ variant: "destructive", title: "上传失败" }); return; }
      const data: ParseResult = await res.json();
      setParseResult(data);

      if (displayFields.length > 0 && data.columns) {
        const autoMap: Record<string, string> = {};
        displayFields.forEach(f => {
          if (data.columns.includes(f.key)) autoMap[f.key] = f.key;
          else if (data.columns.includes(f.label)) autoMap[f.key] = f.label;
        });
        setMapping(autoMap);
      }

      setStep("map");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const reset = () => {
    setStep("upload");
    setParseResult(null);
    setMapping({});
    setSelectedExperimentId("");
    setCreatedCount(0);
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Upload className="w-8 h-8 text-primary" />
          数据导入
        </h1>
        <p className="text-muted-foreground mt-1">上传 CSV 或 Excel 文件，映射字段后批量生成标注任务。</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-3 mb-8">
        {[
          { key: "upload", label: "1. 选择文件" },
          { key: "map", label: "2. 字段映射" },
          { key: "done", label: "3. 完成" },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              step === s.key ? "bg-primary text-primary-foreground" :
              (step === "map" && i === 0) || step === "done" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              {s.label}
            </div>
            {i < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === "upload" && (
        <div className="space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>选择实验</CardTitle>
              <CardDescription>选择将数据导入到哪个实验</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedExperimentId} onValueChange={setSelectedExperimentId}>
                <SelectTrigger data-testid="select-experiment">
                  <SelectValue placeholder="请选择实验..." />
                </SelectTrigger>
                <SelectContent>
                  {experiments.map((exp) => (
                    <SelectItem key={exp.id} value={String(exp.id)} data-testid={`option-experiment-${exp.id}`}>
                      {exp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedTemplate && (
                <div className="flex items-start gap-2 text-xs bg-blue-50 border border-blue-100 rounded-lg p-3 text-blue-800">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold mb-1">使用模板：{selectedTemplate.name}</p>
                    <p>展示字段（{displayFields.length} 个）：{displayFields.map(f => f.label).join("、") || "无"}</p>
                    <p className="mt-0.5 text-blue-600">导入时可将 CSV 列映射到这些字段，其他列也会一并保存。</p>
                  </div>
                </div>
              )}

              {selectedExperiment && !selectedTemplate && (
                <div className="flex items-start gap-2 text-xs bg-muted rounded-lg p-3 text-muted-foreground">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  此实验未绑定标注模板，所有 CSV 列将原样导入。
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>上传文件</CardTitle>
              <CardDescription>支持 .csv、.xlsx、.xls 格式，最大 50MB</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                  isDragging ? "border-primary bg-primary/5" :
                  isUploading ? "border-primary/50 bg-primary/5 cursor-default" :
                  "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
                onDragOver={(e) => { e.preventDefault(); if (!isUploading) setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={isUploading ? undefined : handleDrop}
                onClick={() => {
                  if (isUploading) return;
                  selectedExperimentId ? fileInputRef.current?.click() : toast({ variant: "destructive", title: "请先选择实验" });
                }}
                data-testid="dropzone-upload"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                    <p className="text-sm font-medium text-foreground mb-1">正在上传并解析文件...</p>
                    <p className="text-xs text-muted-foreground">文件已上传至服务器，正在解析中</p>
                  </>
                ) : (
                  <>
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground mb-1">拖放文件到此处，或点击选择文件</p>
                <p className="text-xs text-muted-foreground">CSV / Excel (.xlsx, .xls)，无格式限制</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  data-testid="input-file"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                />
              </div>
              {!selectedExperimentId && (
                <p className="text-xs text-amber-600 mt-3">请先选择实验，再上传文件。</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {step === "map" && parseResult && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              已解析文件：共 <span className="font-semibold text-foreground">{parseResult.totalRows}</span> 行数据，
              检测到 <span className="font-semibold text-foreground">{parseResult.columns.length}</span> 个字段
            </p>
            <Button variant="outline" size="sm" onClick={reset} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              重新上传
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Field mapping */}
            <Card>
              <CardHeader>
                <CardTitle>字段映射</CardTitle>
                <CardDescription>
                  {displayFields.length > 0
                    ? "将文件中的列映射到模板展示字段（可选），未映射字段也会原样保存"
                    : "所有文件列将原样保存到任务数据中，无需手动映射"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {displayFields.length > 0 ? (
                  <div className="space-y-3">
                    {displayFields.map((target) => (
                      <div key={target.key} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{target.label}</p>
                          <p className="text-xs text-muted-foreground font-mono">{target.key}</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1">
                          <Select
                            value={mapping[target.key] || "__none__"}
                            onValueChange={(val) => {
                              setMapping(prev => {
                                const next = { ...prev };
                                if (val === "__none__") { delete next[target.key]; } else { next[target.key] = val; }
                                return next;
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs" data-testid={`select-map-${target.key}`}>
                              <SelectValue placeholder="不映射" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— 不映射 —</SelectItem>
                              {parseResult.columns.map((col) => (
                                <SelectItem key={col} value={col}>{col}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        已映射 {Object.keys(mapping).length}/{displayFields.length} 个字段。
                        文件中其余 {parseResult.columns.length} 列也将一并保存。
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm text-muted-foreground space-y-2">
                    <p>此实验未绑定模板，所有字段将原样导入。</p>
                    <div className="flex flex-wrap gap-1 justify-center mt-3">
                      {parseResult.columns.map(c => <Badge key={c} variant="outline" className="text-xs">{c}</Badge>)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Preview */}
            <Card>
              <CardHeader>
                <CardTitle>数据预览</CardTitle>
                <CardDescription>文件前 5 行样本</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {parseResult.columns.slice(0, 5).map((col) => (
                        <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                      ))}
                      {parseResult.columns.length > 5 && <TableHead className="text-xs text-muted-foreground">+{parseResult.columns.length - 5} 列</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parseResult.preview.map((row, i) => (
                      <TableRow key={i}>
                        {parseResult.columns.slice(0, 5).map((col) => (
                          <TableCell key={col} className="text-xs py-2 max-w-24 truncate">{String(row[col] ?? "")}</TableCell>
                        ))}
                        {parseResult.columns.length > 5 && <TableCell />}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              onClick={() => createTasksMutation.mutate()}
              disabled={createTasksMutation.isPending}
              className="gap-2"
              data-testid="button-confirm-import"
            >
              {createTasksMutation.isPending ? "导入中..." : `确认导入 ${parseResult.totalRows} 条数据`}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="max-w-md mx-auto text-center py-16">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">导入成功</h2>
          <p className="text-muted-foreground mb-6">
            已批量创建 <span className="font-semibold text-foreground">{createdCount}</span> 条标注任务。
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={reset} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              继续导入
            </Button>
            <Button onClick={() => window.location.href = "/tasks"}>查看任务列表</Button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
