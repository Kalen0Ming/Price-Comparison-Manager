import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { User } from "@shared/schema";

export function getCurrentUser(): User | null {
  try {
    const stored = localStorage.getItem("current_user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function useCurrentUser(): User | null {
  return getCurrentUser();
}

export function useLogin() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) throw new Error("用户名或密码错误");
      const user: User = await res.json();
      localStorage.setItem("current_user", JSON.stringify(user));
      return user;
    },
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({ title: "登录成功", description: `欢迎回来，${user.username}！` });
      if (user.role === "publisher") {
        setLocation("/experiments");
      } else {
        setLocation("/dashboard");
      }
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "登录失败", description: error.message });
    },
  });
}

export function useLogout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return () => {
    localStorage.removeItem("current_user");
    queryClient.clear();
    toast({ title: "已退出登录" });
    setLocation("/");
  };
}

export function useUnreadCount() {
  const user = getCurrentUser();
  return useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count", user?.id],
    queryFn: async () => {
      if (!user) return { count: 0 };
      const res = await fetch(`/api/notifications/unread-count?userId=${user.id}`);
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 30000, // poll every 30s
  });
}
