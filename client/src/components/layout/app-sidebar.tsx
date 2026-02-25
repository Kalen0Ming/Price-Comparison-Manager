import { Link, useLocation } from "wouter";
import {
  Users, FlaskConical, CheckSquare, LayoutDashboard,
  LogOut, Upload, Link2, ClipboardList, ShieldCheck, LayoutTemplate,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
} from "@/components/ui/sidebar";
import { useLogout, getCurrentUser } from "@/hooks/use-auth";

const adminOnlyItems = [
  { title: "仪表盘", url: "/dashboard", icon: LayoutDashboard },
  { title: "用户管理", url: "/users", icon: Users },
];

const managerItems = [
  { title: "实验管理", url: "/experiments", icon: FlaskConical },
  { title: "复核任务", url: "/review-tasks", icon: ShieldCheck },
  { title: "分配批次管理", url: "/tasks", icon: CheckSquare },
];

const annotatorExtraItems = [
  { title: "复核任务", url: "/review-tasks", icon: ShieldCheck },
];

const dataItems = [
  { title: "标注模板", url: "/templates", icon: LayoutTemplate },
  { title: "数据导入", url: "/import", icon: Upload },
  { title: "API 连接器", url: "/connector", icon: Link2 },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "管理员",
  publisher: "实验发布者",
  annotator: "标注员",
  reviewer: "复核员",
};

export function AppSidebar() {
  const [location] = useLocation();
  const logout = useLogout();
  const user = getCurrentUser();
  const role = user?.role ?? "annotator";
  const isAdmin = role === "admin";
  const isManager = role === "admin" || role === "publisher" || role === "reviewer";

  const isActive = (url: string) =>
    location === url ||
    (url === "/review-tasks" && location.startsWith("/review/")) ||
    (url === "/experiments" && location.startsWith("/experiments/"));

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent>
        <SidebarGroup>
          <div className="p-4 mb-2">
            <h2 className="text-lg font-bold text-sidebar-primary-foreground leading-tight">
              数据标注实验平台
            </h2>
            <p className="text-xs text-sidebar-foreground/60 mt-1">
              {ROLE_LABELS[role] ?? role}
            </p>
          </div>

          {isAdmin && (
            <>
              <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-xs">
                系统管理
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminOnlyItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        tooltip={item.title}
                        className={isActive(item.url)
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
            </>
          )}

          {isManager && (
            <>
              <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-xs mt-2">
                实验管理
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {managerItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.url)}
                        tooltip={item.title}
                        className={isActive(item.url)
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
            </>
          )}

          <>
            <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-xs mt-2">
              我的工作
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/my-tasks")}
                    tooltip="我的任务"
                    className={isActive("/my-tasks")
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"}
                  >
                    <Link href="/my-tasks" className="flex items-center gap-3">
                      <ClipboardList className="w-5 h-5" />
                      <span className="font-medium">我的任务</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {!isManager && annotatorExtraItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className={isActive(item.url)
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
          </>
        </SidebarGroup>

        {isManager && (
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
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className={isActive(item.url)
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
              <p className="text-xs text-sidebar-foreground/50">{ROLE_LABELS[role] ?? role}</p>
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
