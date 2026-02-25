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
import { useUsers } from "@/hooks/use-users";
import { Users as UsersIcon } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  admin: "管理员",
  reviewer: "复核员",
  annotator: "标注员",
};

export default function Users() {
  const { data: users = [], isLoading } = useUsers();

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <UsersIcon className="w-8 h-8 text-primary" />
          用户管理
        </h1>
        <p className="text-muted-foreground mt-1">管理标注员、复核员和管理员账号。</p>
      </div>

      <Card className="premium-shadow border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="font-semibold">ID</TableHead>
                <TableHead className="font-semibold">用户名</TableHead>
                <TableHead className="font-semibold">邮箱</TableHead>
                <TableHead className="font-semibold">角色</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">加载中...</TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">暂无用户。</TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="text-muted-foreground">#{user.id}</TableCell>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell className="text-slate-600">{user.email}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                          user.role === 'reviewer' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
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
