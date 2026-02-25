import { Link, useLocation } from "wouter";
import {
  Users, FlaskConical, CheckSquare, Tags, Activity, LayoutDashboard,
  LogOut, Upload, Link2, ClipboardList, ShieldCheck, LayoutTemplate,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
} from "@/components/ui/sidebar";
import { useLogout, getCurrentUser } from "@/hooks/use-auth";

const adminNavItems = [
  { title: "仪表盘", url: "/dashboard", icon: LayoutDashboard },
  { title: "实验管理", url: "/experiments", icon: FlaskConical },
  { title: "复核任务", url: "/review-tasks", icon: ShieldCheck },
  { title: "任务列表", url: "/tasks", icon: CheckSquare },
  { title: "标注结果", url: "/annotations", icon: Tags },
  { title: "用户管理", url: "/users", icon: Users },
  { title: "系统日志", url: "/logs", icon: Activity },
];

const annotatorNavItems = [
  { title: "我的任务", url: "/my-tasks", icon: ClipboardList },
  { title: "复核任务", url: "/review-tasks", icon: ShieldCheck },
];

const dataItems = [
  { title: "标注模板", url: "/templates", icon: LayoutTemplate },
  { title: "数据导入", url: "/import", icon: Upload },
  { title: "API 连接器", url: "/connector", icon: Link2 },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "管理员",
  reviewer: "复核员",
  annotator: "标注员",
};

export function AppSidebar() {
  const [location] = useLocation();
  const logout = useLogout();
  const user = getCurrentUser();
  const isAdmin = user?.role === "admin" || user?.role === "reviewer";

  const navItems = isAdmin ? adminNavItems : annotatorNavItems;

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent>
        <SidebarGroup>
          <div className="p-4 mb-2">
            <h2 className="text-2xl font-bold text-sidebar-primary-foreground flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-primary" />
              <span>LabelFlow</span>
            </h2>
            <p className="text-xs text-sidebar-foreground/60 mt-1">
              {isAdmin ? "管理员工作台" : "标注员工作台"}
            </p>
          </div>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-xs">
            {isAdmin ? "平台管理" : "我的工作"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url || (item.url === "/review-tasks" && location.startsWith("/review/"))}
                    tooltip={item.title}
                    className={location === item.url || (item.url === "/review-tasks" && location.startsWith("/review/"))
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"}
                  >
                    <Link href={item.url} className="flex items-center gap-3">
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-xs">
              数据接入
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {dataItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      tooltip={item.title}
                      className={location === item.url
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"}
                    >
                      <Link href={item.url} className="flex items-center gap-3">
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        {user && (
          <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
              {user.username.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{user.username}</p>
              <p className="text-xs text-sidebar-foreground/50">{ROLE_LABELS[user.role] ?? user.role}</p>
            </div>
          </div>
        )}
        <SidebarMenuButton
          onClick={logout}
          className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors"
        >
          <LogOut className="w-5 h-5 mr-2" />
          <span>退出登录</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
