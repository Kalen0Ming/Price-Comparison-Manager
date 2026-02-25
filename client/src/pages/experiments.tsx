import { useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useExperiments, useCreateExperiment } from "@/hooks/use-experiments";
import { Plus, Beaker, Calendar, Settings2 } from "lucide-react";

// Form Schema
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  deadline: z.string().optional(), // Using string for native date input compatibility
  enableReview: z.boolean().default(false),
  reviewRatio: z.coerce.number().min(0).max(100).default(0),
});

type FormValues = z.infer<typeof formSchema>;

export default function Experiments() {
  const { data: experiments = [], isLoading } = useExperiments();
  const createExperiment = useCreateExperiment();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      deadline: "",
      enableReview: false,
      reviewRatio: 0,
    }
  });

  const onSubmit = (data: FormValues) => {
    createExperiment.mutate({
      ...data,
      deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      status: "draft"
    }, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
      }
    });
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Beaker className="w-8 h-8 text-primary" />
            Experiments
          </h1>
          <p className="text-muted-foreground mt-1">Manage annotation projects and configurations.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 premium-shadow hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <Plus className="w-4 h-4" />
              Create Experiment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] border-border/50 premium-shadow">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">New Experiment</DialogTitle>
              <DialogDescription>
                Configure a new price comparison annotation task.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Experiment Name *</Label>
                <Input id="name" {...form.register("name")} placeholder="e.g. Q3 Electronics Price Match" />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  {...form.register("description")} 
                  placeholder="Provide context for annotators..."
                  className="resize-none h-20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deadline" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    Deadline
                  </Label>
                  <Input id="deadline" type="date" {...form.register("deadline")} />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="reviewRatio" className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-muted-foreground" />
                    Review Ratio (%)
                  </Label>
                  <Input id="reviewRatio" type="number" min="0" max="100" {...form.register("reviewRatio")} />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-slate-50">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Dual Review</Label>
                  <p className="text-sm text-muted-foreground">Require second pass on ratio percentage</p>
                </div>
                <Switch 
                  checked={form.watch("enableReview")}
                  onCheckedChange={(checked) => form.setValue("enableReview", checked)}
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={createExperiment.isPending}>
                  {createExperiment.isPending ? "Creating..." : "Create Experiment"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="premium-shadow border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="font-semibold text-slate-600">Name</TableHead>
                <TableHead className="font-semibold text-slate-600">Status</TableHead>
                <TableHead className="font-semibold text-slate-600">Review Config</TableHead>
                <TableHead className="font-semibold text-slate-600">Created</TableHead>
                <TableHead className="font-semibold text-slate-600">Deadline</TableHead>
                <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading experiments...</TableCell>
                </TableRow>
              ) : experiments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No experiments created yet.</TableCell>
                </TableRow>
              ) : (
                experiments.map((exp) => (
                  <TableRow key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-medium">{exp.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                        ${exp.status === 'draft' ? 'bg-slate-100 text-slate-800' : 
                          exp.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {exp.status.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell>
                      {exp.enableReview ? (
                        <span className="text-sm text-slate-600">{exp.reviewRatio}% sampling</span>
                      ) : (
                        <span className="text-sm text-slate-400">Disabled</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {exp.createdAt ? format(new Date(exp.createdAt), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {exp.deadline ? format(new Date(exp.deadline), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">View</Button>
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
