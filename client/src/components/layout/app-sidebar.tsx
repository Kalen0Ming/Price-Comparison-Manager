import { Link, useLocation } from "wouter";
import {
  Users, FlaskConical, CheckSquare, LayoutDashboard,
  LogOut, Upload, Link2, ClipboardList, LayoutTemplate,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
} from "@/components/ui/sidebar";
import { useLogout, getCurrentUser } from "@/hooks/use-auth";

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
    (url === "/my-tasks" && (location.startsWith("/review") || location.startsWith("/annotation/"))) ||
    (url === "/experiments" && location.startsWith("/experiments/"));

  const menuBtn = (url: string) =>
    isActive(url)
      ? "bg-sidebar-accent text-sidebar-accent-foreground"
      : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50";

  function NavItem({ title, url, icon: Icon }: { title: string; url: string; icon: React.ElementType }) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive(url)} tooltip={title} className={menuBtn(url)}>
          <Link href={url} className="flex items-center gap-3">
            <Icon className="w-5 h-5" />
            <span className="font-medium">{title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent>
        <SidebarGroup>
          {/* Logo */}
          <div className="p-4 mb-2 flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none" className="w-9 h-9 shrink-0">
              <rect width="40" height="40" rx="10" fill="#2563EB"/>
              <path d="M10 21L17 28L30 13" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div>
              <h2 className="text-sm font-bold leading-tight text-sidebar-foreground">数据标注实验平台</h2>
              <p className="text-xs mt-0.5 text-sidebar-foreground/60">{ROLE_LABELS[role] ?? role}</p>
            </div>
          </div>

          {/* 系统管理 - always show 仪表盘; 用户管理 only for admin */}
          <>
            <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-xs">
              系统管理
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem title="仪表盘" url="/dashboard" icon={LayoutDashboard} />
                {isAdmin && <NavItem title="用户管理" url="/users" icon={Users} />}
              </SidebarMenu>
            </SidebarGroupContent>
          </>

          {/* 数据接入 - managers only */}
          {isManager && (
            <>
              <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-xs mt-2">
                数据接入
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItem title="标注模板" url="/templates" icon={LayoutTemplate} />
                  <NavItem title="数据导入" url="/import" icon={Upload} />
                  <NavItem title="API 连接器" url="/connector" icon={Link2} />
                </SidebarMenu>
              </SidebarGroupContent>
            </>
          )}

          {/* 实验管理 - managers only */}
          {isManager && (
            <>
              <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-xs mt-2">
                实验管理
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <NavItem title="实验管理" url="/experiments" icon={FlaskConical} />
                  <NavItem title="实验结果列表" url="/tasks" icon={CheckSquare} />
                </SidebarMenu>
              </SidebarGroupContent>
            </>
          )}

          {/* 我的工作 - all users */}
          <>
            <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-xs mt-2">
              我的工作
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem title="我的任务" url="/my-tasks" icon={ClipboardList} />
              </SidebarMenu>
            </SidebarGroupContent>
          </>
        </SidebarGroup>
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
