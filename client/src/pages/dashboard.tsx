import { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FlaskConical, Users, CheckSquare, Tags, TrendingUp, Award, Settings2, Eye, EyeOff
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { useExperiments } from "@/hooks/use-experiments";
import { useUsers } from "@/hooks/use-users";
import { useTasks } from "@/hooks/use-tasks";
import { useAnnotations } from "@/hooks/use-annotations";

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
            <Input
              placeholder="https://api.shufang.example.com/upload"
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              data-testid="input-shufang-url"
            />
            <p className="text-xs text-muted-foreground">留空则保持不变（当前：{status?.hasUrl ? "已配置" : "未配置"}）</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label>数坊 API 密钥</Label>
              {status?.hasKey && <span className="text-xs text-emerald-600 font-medium">✓ 已配置</span>}
            </div>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="输入 API 密钥..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="pr-10"
                data-testid="input-shufang-key"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">密钥保存后不会明文展示。（当前：{status?.hasKey ? "已配置" : "未配置"}）</p>
          </div>
          <Button
            className="w-full"
            disabled={(!apiUrl && !apiKey) || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
            data-testid="button-save-shufang"
          >
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

export default function Dashboard() {
  const { data: experiments = [] } = useExperiments();
  const { data: users = [] } = useUsers();
  const { data: tasks = [] } = useTasks();
  const { data: annotations = [] } = useAnnotations();

  const { data: overview } = useQuery<OverviewStats>({
    queryKey: ["/api/stats/overview"],
    queryFn: async () => {
      const r = await fetch("/api/stats/overview");
      return r.json();
    },
    refetchInterval: 30000,
  });

  const summaryStats = [
    {
      title: "实验总数",
      value: experiments.length,
      sub: `${experiments.filter(e => e.status === "in_progress").length} 个进行中`,
      icon: FlaskConical,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
    },
    {
      title: "任务总量",
      value: tasks.length,
      sub: `${tasks.filter(t => t.status === "completed").length} 个已完成`,
      icon: CheckSquare,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      title: "标注提交数",
      value: annotations.filter(a => a.type === "initial").length,
      sub: `${annotations.filter(a => a.type === "review").length} 条复核记录`,
      icon: Tags,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: "团队成员",
      value: users.length,
      sub: `${users.filter(u => u.role === "annotator").length} 名标注员`,
      icon: Users,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
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
          <h1 className="text-3xl font-display font-bold text-foreground">统计看板</h1>
          <p className="text-muted-foreground mt-1">实验进度、人员效率与标注质量概览</p>
        </div>
        <ShufangConfigDialog />
      </div>

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
            <CardDescription>各实验任务完成百分比</CardDescription>
          </CardHeader>
          <CardContent>
            {!overview || progressChartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">暂无实验数据</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, progressChartData.length * 52)}>
                <BarChart
                  data={progressChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 48, left: 4, bottom: 4 }}
                >
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
              人均标注效率
            </CardTitle>
            <CardDescription>每位标注员的累计产出与近7天数据</CardDescription>
          </CardHeader>
          <CardContent>
            {!overview || overview.userEfficiency.length === 0 ? (
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
                          <span className={`font-medium ${u.perWeek > 0 ? "text-indigo-600" : "text-muted-foreground"}`}>
                            {u.perWeek}
                          </span>
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
            个人标注准确率
          </CardTitle>
          <CardDescription>
            仅统计已开启复核的实验。准确率 = 初标与复标一致的比例（核心字段：是否同款、价格对比、质量对比）
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!overview || overview.accuracyStats.length === 0 ? (
            <div className="py-10 text-center">
              <Award className="w-10 h-10 mx-auto mb-3 text-slate-200" />
              <p className="text-muted-foreground text-sm">暂无复核数据</p>
              <p className="text-muted-foreground text-xs mt-1">当实验开启复核功能且标注员的标注被抽中复核后，准确率数据将在此显示。</p>
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
                      <td className="py-3 pl-4">
                        <AccuracyBar value={u.accuracy} />
                      </td>
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
