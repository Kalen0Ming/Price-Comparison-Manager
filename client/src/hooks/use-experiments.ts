import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertExperiment, UpdateExperimentRequest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useExperiments() {
  return useQuery({
    queryKey: [api.experiments.list.path],
    queryFn: async () => {
      const res = await fetch(api.experiments.list.path);
      if (!res.ok) {
        // Return empty array on failure to prevent hard crashes during parallel dev
        return [];
      }
      const data = await res.json();
      return api.experiments.list.responses[200].parse(data);
    },
  });
}

export function useCreateExperiment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertExperiment) => {
      const res = await fetch(api.experiments.create.path, {
        method: api.experiments.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create experiment");
      return api.experiments.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.experiments.list.path] });
      toast({ title: "Experiment Created", description: "The experiment has been successfully created." });
    },
    onError: (err) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  });
}
