import { useState } from "react";
import { useLogin } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FlaskConical, ArrowRight } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate({ username, password });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/10 blur-[120px]" />

      <div className="w-full max-w-md p-8 glass-panel rounded-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/70 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/25">
            <FlaskConical className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">LabelFlow</h1>
          <p className="text-muted-foreground mt-2 text-center">
            价格比对标注实验管理平台
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-12 bg-white/50 border-gray-200 focus:border-primary focus:ring-primary/20 transition-all"
              placeholder="请输入用户名"
              data-testid="input-username"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 bg-white/50 border-gray-200 focus:border-primary focus:ring-primary/20 transition-all"
              placeholder="请输入密码"
              data-testid="input-password"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all duration-200"
            disabled={login.isPending}
            data-testid="button-login"
          >
            {login.isPending ? "登录中..." : (
              <>
                登 录
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-border/50 text-center">
          <p className="text-xs text-muted-foreground">
            演示账号：admin / password123
          </p>
        </div>
      </div>
    </div>
  );
}
