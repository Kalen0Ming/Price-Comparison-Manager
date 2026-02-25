import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlaskConical, Users, CheckSquare, Tags, Activity } from "lucide-react";
import { useExperiments } from "@/hooks/use-experiments";
import { useUsers } from "@/hooks/use-users";
import { useTasks } from "@/hooks/use-tasks";
import { useAnnotations } from "@/hooks/use-annotations";

export default function Dashboard() {
  const { data: experiments = [] } = useExperiments();
  const { data: users = [] } = useUsers();
  const { data: tasks = [] } = useTasks();
  const { data: annotations = [] } = useAnnotations();

  const stats = [
    {
      title: "Active Experiments",
      value: experiments.filter(e => e.status !== 'archived').length,
      icon: FlaskConical,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Total Tasks",
      value: tasks.length,
      icon: CheckSquare,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      title: "Annotations Submitted",
      value: annotations.length,
      icon: Tags,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Team Members",
      value: users.length,
      icon: Users,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground">Overview</h1>
        <p className="text-muted-foreground mt-1">Welcome back to the admin workspace.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, i) => (
          <Card key={i} className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-200 premium-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="premium-shadow border-border/50">
          <CardHeader>
            <CardTitle className="font-display">Recent Experiments</CardTitle>
          </CardHeader>
          <CardContent>
            {experiments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No experiments found.</div>
            ) : (
              <div className="space-y-4">
                {experiments.slice(0, 5).map(exp => (
                  <div key={exp.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-slate-50/50">
                    <div>
                      <p className="font-medium">{exp.name}</p>
                      <p className="text-sm text-muted-foreground">{exp.status}</p>
                    </div>
                    <div className="text-sm font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                      {exp.reviewRatio}% Review
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="premium-shadow border-border/50">
          <CardHeader>
            <CardTitle className="font-display">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
               <Activity className="w-12 h-12 mb-4 text-slate-300" />
               <p>Activity visualization will appear here.</p>
             </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
