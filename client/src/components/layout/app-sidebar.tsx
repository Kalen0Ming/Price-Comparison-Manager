import { Link, useLocation } from "wouter";
import { 
  Users, 
  FlaskConical, 
  CheckSquare, 
  Tags, 
  Activity, 
  LayoutDashboard,
  LogOut
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useLogout } from "@/hooks/use-auth";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Experiments", url: "/experiments", icon: FlaskConical },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Annotations", url: "/annotations", icon: Tags },
  { title: "Users", url: "/users", icon: Users },
  { title: "System Logs", url: "/logs", icon: Activity },
];

export function AppSidebar() {
  const [location] = useLocation();
  const logout = useLogout();

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarContent>
        <SidebarGroup>
          <div className="p-4 mb-2">
            <h2 className="text-2xl font-display font-bold text-sidebar-primary-foreground flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-primary" />
              <span>LabelFlow</span>
            </h2>
            <p className="text-xs text-sidebar-foreground/60 mt-1">Admin Workspace</p>
          </div>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase tracking-wider text-xs">
            Platform Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      tooltip={item.title}
                      className={isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"}
                    >
                      <Link href={item.url} className="flex items-center gap-3">
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <SidebarMenuButton 
          onClick={logout}
          className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-colors"
        >
          <LogOut className="w-5 h-5 mr-2" />
          <span>Sign Out</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
