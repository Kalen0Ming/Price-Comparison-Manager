import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLogs } from "@/hooks/use-logs";
import { Activity } from "lucide-react";
import { format } from "date-fns";

export default function Logs() {
  const { data: logs = [], isLoading } = useLogs();

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary" />
          系统日志
        </h1>
        <p className="text-muted-foreground mt-1">平台操作的完整审计记录。</p>
      </div>

      <Card className="premium-shadow border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="font-semibold">时间</TableHead>
                <TableHead className="font-semibold">用户 ID</TableHead>
                <TableHead className="font-semibold">操作</TableHead>
                <TableHead className="font-semibold">IP 地址</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">加载中...</TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">暂无日志记录。</TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                    <TableCell className="text-sm font-mono text-slate-500">
                      {log.createdAt ? format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss') : '-'}
                    </TableCell>
                    <TableCell className="text-slate-600">用户-{log.userId}</TableCell>
                    <TableCell className="font-medium text-slate-700">{log.action}</TableCell>
                    <TableCell className="text-sm text-slate-500">{log.ipAddress || '未知'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
