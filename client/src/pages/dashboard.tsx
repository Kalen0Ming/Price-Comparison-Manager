import { useState, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FlaskConical, Users, CheckSquare, Tags, TrendingUp, Award, Settings2, Eye, EyeOff, Filter, X,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { useExperiments } from "@/hooks/use-experiments";
import { useUsers } from "@/hooks/use-users";
import { useTasks } from "@/hooks/use-tasks";
import { useAnnotations } from "@/hooks/use-annotations";
import { getCurrentUser } from "@/hooks/use-auth";
import { format, subDays } from "date-fns";
import type { User } from "@shared/schema";

interface OverviewStats {
  experimentProgress: Array<{
    id: number; name: string; status: string; total: number; done: number; progress: number;
  }>;
  userEfficiency: Array<{
    userId: number; username: string; totalAnnotated: number; perDay: number; perWeek: number;
  }>;
  accuracyStats: Array<{
    userId: number; username: string; totalReviewed: number; matched: number; accuracy: number;
  }>;
}

function ShufangConfigDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const { data: status } = useQuery<{ configured: boolean; hasUrl: boolean; hasKey: boolean }>({
    queryKey: ["/api/settings/shufang-status"],
    queryFn: async () => {
      const r = await fetch("/api/settings/shufang-status");
      return r.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const calls = [];
      if (apiUrl) calls.push(fetch("/api/settings/shufang_api_url", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: apiUrl }) }));
      if (apiKey) calls.push(fetch("/api/settings/shufang_api_key", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value: apiKey }) }));
      await Promise.all(calls);
    },
    onSuccess: () => {
      toast({ title: "数坊配置已保存" });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/shufang-status"] });
      setOpen(false);
      setApiUrl("");
      setApiKey("");
    },
    onError: () => toast({ variant: "destructive", title: "保存失败" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-shufang-config">
          <Settings2 className="w-4 h-4" />
          数坊集成配置
          {status?.configured && (
            <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>配置数坊 API 集成</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-700">
            数坊集成配置后，归档实验时会自动将 ZIP 数据包上传至数坊数据仓库。
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label>数坊 API 地址</Label>
              {status?.hasUrl && <span className="text-xs text-emerald-600 font-medium">✓ 已配置</span>}
            </div>
            <Input placeholder="https://api.shufang.example.com/upload" value={apiUrl} onChange={e => setApiUrl(e.target.value)} data-testid="input-shufang-url" />
            <p className="text-xs text-muted-foreground">留空则保持不变（当前：{status?.hasUrl ? "已配置" : "未配置"}）</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label>数坊 API 密钥</Label>
              {status?.hasKey && <span className="text-xs text-emerald-600 font-medium">✓ 已配置</span>}
            </div>
            <div className="relative">
              <Input type={showKey ? "text" : "password"} placeholder="输入 API 密钥..." value={apiKey} onChange={e => setApiKey(e.target.value)} className="pr-10" data-testid="input-shufang-key" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">密钥保存后不会明文展示。（当前：{status?.hasKey ? "已配置" : "未配置"}）</p>
          </div>
          <Button className="w-full" disabled={(!apiUrl && !apiKey) || saveMutation.isPending} onClick={() => saveMutation.mutate()} data-testid="button-save-shufang">
            {saveMutation.isPending ? "保存中..." : "保存配置"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AccuracyBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-emerald-500" : value >= 60 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs tabular-nums w-10 text-right font-medium">{value}%</span>
    </div>
  );
}

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

const DEFAULT_DATE_FROM = format(subDays(new Date(), 30), "yyyy-MM-dd");
const DEFAULT_DATE_TO = format(new Date(), "yyyy-MM-dd");

export default function Dashboard() {
  const currentUser = getCurrentUser();
  const isAnnotator = currentUser?.role === "annotator";
  const isAdmin = currentUser?.role === "admin";

  const { data: experiments = [] } = useExperiments();
  const { data: users = [] } = useUsers();
  const { data: tasks = [] } = useTasks();
  const { data: annotations = [] } = useAnnotations();

  const [dateFrom, setDateFrom] = useState(DEFAULT_DATE_FROM);
  const [dateTo, setDateTo] = useState(DEFAULT_DATE_TO);
  const [annotatorIds, setAnnotatorIds] = useState<string[]>([]);
  const [experimentCode, setExperimentCode] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const annotators = (users as User[]).filter(u => u.role === "annotator");

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (dateFrom) p.set("dateFrom", new Date(dateFrom).toISOString());
    if (dateTo) p.set("dateTo", new Date(dateTo + "T23:59:59").toISOString());
    if (annotatorIds.length > 0) p.set("annotatorId", annotatorIds.join(","));
    if (experimentCode) p.set("experimentCode", experimentCode);
    if (isAnnotator && currentUser?.id) {
      p.set("selfOnly", "true");
      p.set("userId", String(currentUser.id));
    }
    return p.toString();
  }, [dateFrom, dateTo, annotatorIds, experimentCode, isAnnotator, currentUser?.id]);

  const { data: overview, isLoading: overviewLoading } = useQuery<OverviewStats>({
    queryKey: ["/api/stats/overview", dateFrom, dateTo, annotatorIds.join(","), experimentCode, currentUser?.id],
    queryFn: async () => {
      const r = await fetch(`/api/stats/overview?${buildParams()}`);
      return r.json();
    },
    refetchInterval: 30000,
  });

  const hasActiveFilters = dateFrom !== DEFAULT_DATE_FROM || dateTo !== DEFAULT_DATE_TO || annotatorIds.length > 0 || experimentCode !== "";

  const resetFilters = () => {
    setDateFrom(DEFAULT_DATE_FROM);
    setDateTo(DEFAULT_DATE_TO);
    setAnnotatorIds([]);
    setExperimentCode("");
  };

  const toggleAnnotator = (id: string) => {
    setAnnotatorIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Summary stats - annotators see their own data
  const myAnnotations = annotations.filter((a: any) => isAnnotator ? a.userId === currentUser?.id : true);
  const myTasks = tasks.filter((t: any) => isAnnotator ? t.assignedTo === currentUser?.id : true);

  const summaryStats = [
    {
      title: "实验总数",
      value: experiments.length,
      sub: `${experiments.filter((e: any) => e.status === "in_progress").length} 个进行中`,
      icon: FlaskConical, color: "text-indigo-500", bg: "bg-indigo-500/10",
    },
    {
      title: isAnnotator ? "我的任务" : "任务总量",
      value: myTasks.length,
      sub: `${myTasks.filter((t: any) => t.status === "completed").length} 个已完成`,
      icon: CheckSquare, color: "text-amber-500", bg: "bg-amber-500/10",
    },
    {
      title: isAnnotator ? "我的标注数" : "标注提交数",
      value: myAnnotations.filter((a: any) => a.type === "initial").length,
      sub: `${myAnnotations.filter((a: any) => a.type === "review").length} 条复核记录`,
      icon: Tags, color: "text-emerald-500", bg: "bg-emerald-500/10",
    },
    {
      title: isAnnotator ? "团队规模" : "团队成员",
      value: isAnnotator ? (users as User[]).length : (users as User[]).length,
      sub: `${(users as User[]).filter(u => u.role === "annotator").length} 名标注员`,
      icon: Users, color: "text-purple-500", bg: "bg-purple-500/10",
    },
  ];

  const progressChartData = (overview?.experimentProgress || []).map(e => ({
    name: e.name.length > 12 ? e.name.slice(0, 12) + "…" : e.name,
    fullName: e.name,
    进度: e.progress,
    已完成: e.done,
    总任务: e.total,
  }));

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            {isAnnotator ? "我的数据看板" : "统计看板"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAnnotator ? "您的标注进度与准确率概览" : "实验进度、人员效率与标注质量概览"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="w-4 h-4" />
            筛选
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={resetFilters} data-testid="button-reset-filters">
              <X className="w-3.5 h-3.5" />重置
            </Button>
          )}
          {isAdmin && <ShufangConfigDialog />}
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card className="mb-6 border-border/50">
          <CardContent className="pt-5 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">实验发布开始日期</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  data-testid="input-filter-date-from"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">实验发布截止日期</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  data-testid="input-filter-date-to"
                />
              </div>
              {!isAnnotator && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">标注员（可多选）</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start font-normal text-sm h-10"
                        data-testid="button-filter-annotator"
                      >
                        {annotatorIds.length === 0
                          ? <span className="text-muted-foreground">全部标注员</span>
                          : <span>已选 {annotatorIds.length} 位标注员</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="start">
                      <div className="space-y-1">
                        <button
                          className="w-full text-left text-xs text-muted-foreground px-2 py-1 hover:text-foreground"
                          onClick={() => setAnnotatorIds([])}
                        >
                          清除选择
                        </button>
                        {annotators.map(u => (
                          <div
                            key={u.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                            onClick={() => toggleAnnotator(String(u.id))}
                          >
                            <Checkbox
                              checked={annotatorIds.includes(String(u.id))}
                              onCheckedChange={() => toggleAnnotator(String(u.id))}
                              data-testid={`checkbox-annotator-${u.id}`}
                            />
                            <span className="text-sm">{u.username}</span>
                          </div>
                        ))}
                        {annotators.length === 0 && (
                          <p className="text-xs text-muted-foreground px-2 py-1">暂无标注员</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">实验名称 / 编码搜索</Label>
                <Input
                  placeholder="输入实验名称或编码..."
                  value={experimentCode}
                  onChange={e => setExperimentCode(e.target.value)}
                  data-testid="input-filter-exp-code"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <p className="text-xs text-muted-foreground mt-3">
                当前筛选：{dateFrom} 至 {dateTo}
                {annotatorIds.length > 0 && ` · ${annotatorIds.length} 位标注员`}
                {experimentCode && ` · 搜索"${experimentCode}"`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {summaryStats.map((stat, i) => (
          <Card key={i} className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold" data-testid={`stat-${stat.title}`}>{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <TrendingUp className="w-5 h-5 text-indigo-500" />
              实验完成进度
            </CardTitle>
            <CardDescription>
              {hasActiveFilters ? "按筛选条件显示实验进度" : "近30天各实验任务完成百分比"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">加载中...</div>
            ) : !overview || progressChartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">暂无实验数据</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, progressChartData.length * 52)}>
                <BarChart data={progressChartData} layout="vertical" margin={{ top: 4, right: 48, left: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      return (
                        <div className="bg-white border border-border rounded-lg shadow-lg p-3 text-sm">
                          <p className="font-medium mb-1">{d?.fullName || label}</p>
                          <p className="text-muted-foreground">进度：{d?.进度}%（{d?.已完成}/{d?.总任务} 条）</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="进度" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {progressChartData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Users className="w-5 h-5 text-purple-500" />
              {isAnnotator ? "我的标注效率" : "人均标注效率"}
            </CardTitle>
            <CardDescription>
              {isAnnotator ? "您的累计产出与近7天数据" : "每位标注员的累计产出与近7天数据"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">加载中...</div>
            ) : !overview || overview.userEfficiency.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">暂无标注员数据</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 text-left font-medium">标注员</th>
                      <th className="py-2 text-right font-medium">累计完成</th>
                      <th className="py-2 text-right font-medium">日均</th>
                      <th className="py-2 text-right font-medium">近7天</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {overview.userEfficiency.map(u => (
                      <tr key={u.userId} data-testid={`row-efficiency-${u.userId}`}>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium">{u.username}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right font-semibold">{u.totalAnnotated}</td>
                        <td className="py-2.5 text-right text-muted-foreground">{u.perDay}</td>
                        <td className="py-2.5 text-right">
                          <span className={`font-medium ${u.perWeek > 0 ? "text-indigo-600" : "text-muted-foreground"}`}>{u.perWeek}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <Award className="w-5 h-5 text-amber-500" />
            {isAnnotator ? "我的准确率" : "个人标注准确率"}
          </CardTitle>
          <CardDescription>
            仅统计已开启复核的实验。准确率 = 初标与复标一致的比例
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overviewLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">加载中...</div>
          ) : !overview || overview.accuracyStats.length === 0 ? (
            <div className="py-10 text-center">
              <Award className="w-10 h-10 mx-auto mb-3 text-slate-200" />
              <p className="text-muted-foreground text-sm">暂无复核数据</p>
              <p className="text-muted-foreground text-xs mt-1">当实验开启复核功能且标注被抽中复核后，准确率数据将在此显示。</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-left font-medium w-8">#</th>
                    <th className="py-2 text-left font-medium">标注员</th>
                    <th className="py-2 text-right font-medium">被复核次数</th>
                    <th className="py-2 text-right font-medium">一致次数</th>
                    <th className="py-2 text-left font-medium pl-4 min-w-[180px]">准确率</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {overview.accuracyStats.map((u, idx) => (
                    <tr key={u.userId} data-testid={`row-accuracy-${u.userId}`}>
                      <td className="py-3 text-muted-foreground">{idx + 1}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? "bg-amber-100 text-amber-700" : idx === 1 ? "bg-slate-100 text-slate-600" : idx === 2 ? "bg-orange-100 text-orange-700" : "bg-indigo-50 text-indigo-600"}`}>
                            {idx < 3 ? ["🥇", "🥈", "🥉"][idx] : u.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{u.username}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-muted-foreground">{u.totalReviewed}</td>
                      <td className="py-3 text-right font-medium">{u.matched}</td>
                      <td className="py-3 pl-4"><AccuracyBar value={u.accuracy} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
