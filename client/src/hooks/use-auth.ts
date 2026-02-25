import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export function useLogin() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      // For demonstration, we allow the hardcoded admin pass, or try to hit the API
      if (credentials.username === 'admin' && credentials.password === 'password123') {
        // Mock success
        localStorage.setItem("auth_token", "mock_token");
        return { id: 1, username: 'admin', role: 'admin', email: 'admin@test.com' };
      }

      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      if (!res.ok) {
        throw new Error("Invalid credentials");
      }
      return api.auth.login.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      toast({
        title: "Welcome back",
        description: "You have successfully logged in.",
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error.message,
      });
    },
  });
}

export function useLogout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  return () => {
    localStorage.removeItem("auth_token");
    toast({ title: "Logged out successfully" });
    setLocation("/");
  };
}
