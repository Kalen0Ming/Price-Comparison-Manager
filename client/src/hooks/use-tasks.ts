import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useTasks() {
  return useQuery({
    queryKey: [api.tasks.list.path],
    queryFn: async () => {
      const res = await fetch(api.tasks.list.path);
      if (!res.ok) return [];
      return api.tasks.list.responses[200].parse(await res.json());
    },
  });
}
