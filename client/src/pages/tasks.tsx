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
import { useTasks } from "@/hooks/use-tasks";
import { CheckSquare } from "lucide-react";
import { format } from "date-fns";

const STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  assigned: "已分配",
  annotated: "已标注",
  needs_review: "待复核",
  completed: "已完成",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  assigned: "bg-blue-100 text-blue-800",
  annotated: "bg-emerald-100 text-emerald-800",
  needs_review: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
};

export default function Tasks() {
  const { data: tasks = [], isLoading } = useTasks();

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <CheckSquare className="w-8 h-8 text-primary" />
          任务列表
        </h1>
        <p className="text-muted-foreground mt-1">查看所有等待标注的任务条目。</p>
      </div>

      <Card className="premium-shadow border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="font-semibold">任务 ID</TableHead>
                <TableHead className="font-semibold">实验 ID</TableHead>
                <TableHead className="font-semibold">状态</TableHead>
                <TableHead className="font-semibold">创建时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">加载中...</TableCell>
                </TableRow>
              ) : tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">暂无任务。</TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow key={task.id} data-testid={`row-task-${task.id}`}>
                    <TableCell className="font-medium">#{task.id}</TableCell>
                    <TableCell className="text-slate-600">实验-{task.experimentId}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] ?? 'bg-slate-100 text-slate-800'}`}>
                        {STATUS_LABELS[task.status] ?? task.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {task.createdAt ? format(new Date(task.createdAt), 'yyyy-MM-dd HH:mm') : '-'}
                    </TableCell>
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
