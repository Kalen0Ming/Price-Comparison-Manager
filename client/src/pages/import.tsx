import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, ArrowRight, CheckCircle, ChevronRight, RotateCcw } from "lucide-react";
import type { Experiment } from "@shared/schema";

const TARGET_FIELDS = [
  { key: "productA_name", label: "商品A 名称" },
  { key: "productA_price", label: "商品A 价格" },
  { key: "productA_source", label: "商品A 来源平台" },
  { key: "productA_url", label: "商品A 链接" },
  { key: "productB_name", label: "商品B 名称" },
  { key: "productB_price", label: "商品B 价格" },
  { key: "productB_source", label: "商品B 来源平台" },
  { key: "productB_url", label: "商品B 链接" },
];

type Step = "upload" | "map" | "done";

interface ParseResult {
  columns: string[];
  preview: Record<string, string>[];
  totalRows: number;
  rawRows?: Record<string, string>[];
}

export default function ImportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [selectedExperimentId, setSelectedExperimentId] = useState<string>("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  const { data: experiments = [] } = useQuery<Experiment[]>({
    queryKey: ["/api/experiments"],
    queryFn: async () => {
      const res = await fetch("/api/experiments");
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("文件解析失败");
      return res.json() as Promise<ParseResult>;
    },
    onSuccess: (data) => {
      setParseResult(data);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "上传失败", description: err.message });
    },
  });

  const createTasksMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/import/create-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          experimentId: Number(selectedExperimentId),
          rows: rawRows,
          mapping,
        }),
      });
      if (!res.ok) throw new Error("创建任务失败");
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
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/import/upload", { method: "POST", body: formData });
    if (!res.ok) { toast({ variant: "destructive", title: "上传失败" }); return; }
    const data = await res.json();

    // Store full rows separately via re-parse (XLSX on client)
    // We'll send the preview rows for mapping, and backend will use rows stored in session
    // For simplicity: we store the preview data and let the user confirm
    setParseResult(data);
    // We need to re-upload to get all rows - so we store file ref
    // Actually: we send all rows in step 2 from a second read. 
    // For now use the preview as sample, then send full rows via create-tasks.
    // Let's read all rows by storing the file and re-reading
    const reader = new FileReader();
    reader.onload = async (e) => {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(e.target?.result, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      setRawRows(rows);
    };
    reader.readAsArrayBuffer(file);
    setStep("map");
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
    setRawRows([]);
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

      {/* Steps Indicator */}
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
            <CardContent>
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
                  isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-upload"
              >
                <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground mb-1">拖放文件到此处，或点击选择文件</p>
                <p className="text-xs text-muted-foreground">CSV / Excel (.xlsx, .xls)</p>
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
            <div>
              <p className="text-sm text-muted-foreground">
                已解析文件：共 <span className="font-semibold text-foreground">{parseResult.totalRows}</span> 行数据，
                检测到 <span className="font-semibold text-foreground">{parseResult.columns.length}</span> 个字段
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={reset} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              重新上传
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>字段映射</CardTitle>
                <CardDescription>将文件中的列映射到系统标准字段（可选）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {TARGET_FIELDS.map((target) => (
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
                </div>
              </CardContent>
            </Card>

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
            已为实验批量创建 <span className="font-semibold text-foreground">{createdCount}</span> 条标注任务。
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
