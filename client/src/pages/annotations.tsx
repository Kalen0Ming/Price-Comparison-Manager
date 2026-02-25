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

export default function Annotations() {
  const { data: annotations = [], isLoading } = useAnnotations();

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Tags className="w-8 h-8 text-primary" />
          Annotations
        </h1>
        <p className="text-muted-foreground mt-1">Review submitted labeling results.</p>
      </div>

      <Card className="premium-shadow border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="font-semibold">ID</TableHead>
                <TableHead className="font-semibold">Task ID</TableHead>
                <TableHead className="font-semibold">User ID</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Submitted</TableHead>
                <TableHead className="text-right font-semibold">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading annotations...</TableCell>
                </TableRow>
              ) : annotations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No annotations found.</TableCell>
                </TableRow>
              ) : (
                annotations.map((ann) => (
                  <TableRow key={ann.id}>
                    <TableCell className="font-medium">#{ann.id}</TableCell>
                    <TableCell className="text-slate-600">Task-{ann.taskId}</TableCell>
                    <TableCell className="text-slate-600">User-{ann.userId}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                        ${ann.type === 'initial' ? 'bg-slate-100 text-slate-800' : 'bg-purple-100 text-purple-800'}`}>
                        {ann.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {ann.createdAt ? format(new Date(ann.createdAt), 'MMM d, HH:mm') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                       <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-600">
                         {JSON.stringify(ann.result).substring(0, 20)}...
                       </span>
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
