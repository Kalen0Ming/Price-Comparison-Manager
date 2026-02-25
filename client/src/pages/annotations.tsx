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
import { useAnnotations } from "@/hooks/use-annotations";
import { Tags } from "lucide-react";
import { format } from "date-fns";

const TYPE_LABELS: Record<string, string> = {
  initial: "初始标注",
  review: "复核标注",
  draft: "草稿",
};

export default function Annotations() {
  const { data: annotations = [], isLoading } = useAnnotations();

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Tags className="w-8 h-8 text-primary" />
          标注结果
        </h1>
        <p className="text-muted-foreground mt-1">查看所有已提交的标注结果。</p>
      </div>

      <Card className="premium-shadow border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="font-semibold">ID</TableHead>
                <TableHead className="font-semibold">任务 ID</TableHead>
                <TableHead className="font-semibold">标注员</TableHead>
                <TableHead className="font-semibold">类型</TableHead>
                <TableHead className="font-semibold">提交时间</TableHead>
                <TableHead className="text-right font-semibold">标注数据</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">加载中...</TableCell>
                </TableRow>
              ) : annotations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">暂无标注结果。</TableCell>
                </TableRow>
              ) : (
                annotations.map((ann) => (
                  <TableRow key={ann.id} data-testid={`row-annotation-${ann.id}`}>
                    <TableCell className="font-medium">#{ann.id}</TableCell>
                    <TableCell className="text-slate-600">任务-{ann.taskId}</TableCell>
                    <TableCell className="text-slate-600">用户-{ann.userId}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${ann.type === 'initial' ? 'bg-slate-100 text-slate-800' :
                          ann.type === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}`}>
                        {TYPE_LABELS[ann.type] ?? ann.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {ann.createdAt ? format(new Date(ann.createdAt), 'yyyy-MM-dd HH:mm') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <code className="text-xs bg-muted rounded px-1 py-0.5 max-w-48 truncate block text-right">
                        {JSON.stringify(ann.result).slice(0, 60)}...
                      </code>
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
