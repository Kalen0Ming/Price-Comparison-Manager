import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useAnnotations() {
  return useQuery({
    queryKey: [api.annotations.list.path],
    queryFn: async () => {
      const res = await fetch(api.annotations.list.path);
      if (!res.ok) return [];
      return api.annotations.list.responses[200].parse(await res.json());
    },
  });
}
