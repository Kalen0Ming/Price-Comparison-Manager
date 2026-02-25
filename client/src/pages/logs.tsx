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
          System Logs
        </h1>
        <p className="text-muted-foreground mt-1">Audit trail of platform activities.</p>
      </div>

      <Card className="premium-shadow border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="font-semibold">Timestamp</TableHead>
                <TableHead className="font-semibold">User ID</TableHead>
                <TableHead className="font-semibold">Action</TableHead>
                <TableHead className="font-semibold">IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Loading logs...</TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No logs recorded.</TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm font-mono text-slate-500">
                      {log.createdAt ? format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss') : '-'}
                    </TableCell>
                    <TableCell className="text-slate-600">User-{log.userId}</TableCell>
                    <TableCell className="font-medium text-slate-700">{log.action}</TableCell>
                    <TableCell className="text-sm text-slate-500">{log.ipAddress || 'Unknown'}</TableCell>
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
