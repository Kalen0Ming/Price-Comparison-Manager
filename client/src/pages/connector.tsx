import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Link2, Play, Trash2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { format } from "date-fns";
import type { ApiConnector, Experiment } from "@shared/schema";

const connectorSchema = z.object({
  name: z.string().min(1, "名称不能为空"),
  url: z.string().url("请输入有效的URL"),
  authType: z.enum(["none", "api_key", "bearer"]),
  authValue: z.string().optional(),
  fetchFrequency: z.enum(["manual", "daily"]),
  experimentId: z.coerce.number().optional(),
  fieldMapping: z.string().optional(),
});

type ConnectorFormValues = z.infer<typeof connectorSchema>;

export default function ConnectorPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [triggeringId, setTriggeringId] = useState<number | null>(null);

  const { data: connectors = [], isLoading } = useQuery<ApiConnector[]>({
    queryKey: ["/api/connectors"],
    queryFn: async () => { const r = await fetch("/api/connectors"); return r.json(); },
  });

  const { data: experiments = [] } = useQuery<Experiment[]>({
    queryKey: ["/api/experiments"],
    queryFn: async () => { const r = await fetch("/api/experiments"); return r.json(); },
  });

  const form = useForm<ConnectorFormValues>({
    resolver: zodResolver(connectorSchema),
    defaultValues: { name: "", url: "", authType: "api_key", authValue: "", fetchFrequency: "manual", fieldMapping: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ConnectorFormValues) => {
      let fieldMapping: Record<string, string> | undefined;
      if (data.fieldMapping) {
        try { fieldMapping = JSON.parse(data.fieldMapping); } catch { fieldMapping = undefined; }
      }
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, fieldMapping, status: "active" }),
      });
      if (!res.ok) throw new Error("创建失败");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      toast({ title: "连接器已创建", description: "API 数据源配置成功。" });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: () => toast({ variant: "destructive", title: "创建失败" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/connectors/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      toast({ title: "已删除连接器" });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: async (id: number) => {
      setTriggeringId(id);
      const res = await fetch(`/api/connectors/${id}/trigger`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "拉取失败");
      return data as { fetched: number; created: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/connectors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "数据拉取成功", description: `获取 ${data.fetched} 条，创建 ${data.created} 个任务。` });
      setTriggeringId(null);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "拉取失败", description: err.message });
      setTriggeringId(null);
    },
  });

  const authType = form.watch("authType");

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Link2 className="w-8 h-8 text-primary" />
            API 数据连接器
          </h1>
          <p className="text-muted-foreground mt-1">配置外部系统接口，定时或手动拉取数据生成标注任务。</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-new-connector">
              <Plus className="w-4 h-4" />
              添加连接器
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>新建 API 连接器</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="conn-name">连接器名称</Label>
                <Input id="conn-name" {...form.register("name")} placeholder="如：商品库 API" data-testid="input-connector-name" />
                {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="conn-url">API URL</Label>
                <Input id="conn-url" {...form.register("url")} placeholder="https://api.example.com/products" data-testid="input-connector-url" />
                {form.formState.errors.url && <p className="text-xs text-destructive">{form.formState.errors.url.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>认证方式</Label>
                  <Select value={form.watch("authType")} onValueChange={(v) => form.setValue("authType", v as any)}>
                    <SelectTrigger data-testid="select-auth-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">无认证</SelectItem>
                      <SelectItem value="api_key">API Key</SelectItem>
                      <SelectItem value="bearer">Bearer Token</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>拉取频率</Label>
                  <Select value={form.watch("fetchFrequency")} onValueChange={(v) => form.setValue("fetchFrequency", v as any)}>
                    <SelectTrigger data-testid="select-frequency"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">手动触发</SelectItem>
                      <SelectItem value="daily">每天</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {authType !== "none" && (
                <div className="space-y-1.5">
                  <Label htmlFor="conn-auth-val">{authType === "api_key" ? "API Key 值" : "Token 值"}</Label>
                  <Input id="conn-auth-val" {...form.register("authValue")} type="password" placeholder="输入认证凭证" data-testid="input-auth-value" />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>关联实验</Label>
                <Select value={String(form.watch("experimentId") || "")} onValueChange={(v) => form.setValue("experimentId", Number(v))}>
                  <SelectTrigger data-testid="select-connector-experiment"><SelectValue placeholder="选择实验..." /></SelectTrigger>
                  <SelectContent>
                    {experiments.map((exp) => (
                      <SelectItem key={exp.id} value={String(exp.id)}>{exp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="conn-mapping">字段映射 (JSON，可选)</Label>
                <Input
                  id="conn-mapping"
                  {...form.register("fieldMapping")}
                  placeholder='{"productA_name": "title", "productA_price": "price"}'
                  data-testid="input-field-mapping"
                />
                <p className="text-xs text-muted-foreground">将 API 返回的字段映射到系统字段。格式：目标字段: 源字段。</p>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-connector">
                  {createMutation.isPending ? "保存中..." : "保存连接器"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>API 地址</TableHead>
                <TableHead>认证</TableHead>
                <TableHead>频率</TableHead>
                <TableHead>最后拉取</TableHead>
                <TableHead>关联实验</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
              ) : connectors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <WifiOff className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-muted-foreground">尚未配置任何 API 连接器</p>
                  </TableCell>
                </TableRow>
              ) : (
                connectors.map((conn) => {
                  const exp = experiments.find((e) => e.id === conn.experimentId);
                  return (
                    <TableRow key={conn.id} data-testid={`row-connector-${conn.id}`}>
                      <TableCell className="font-medium">{conn.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono max-w-48 truncate">{conn.url}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {conn.authType === "none" ? "无" : conn.authType === "api_key" ? "API Key" : "Bearer"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={conn.fetchFrequency === "daily" ? "default" : "secondary"} className="text-xs">
                          {conn.fetchFrequency === "daily" ? "每天" : "手动"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {conn.lastFetchedAt ? format(new Date(conn.lastFetchedAt), "MM-dd HH:mm") : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{exp?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs"
                            disabled={triggeringId === conn.id}
                            onClick={() => triggerMutation.mutate(conn.id)}
                            data-testid={`button-trigger-${conn.id}`}
                          >
                            {triggeringId === conn.id
                              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              : <Play className="w-3.5 h-3.5" />}
                            立即拉取
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(conn.id)}
                            data-testid={`button-delete-connector-${conn.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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
