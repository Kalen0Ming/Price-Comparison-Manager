import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useLogs() {
  return useQuery({
    queryKey: [api.logs.list.path],
    queryFn: async () => {
      const res = await fetch(api.logs.list.path);
      if (!res.ok) return [];
      return api.logs.list.responses[200].parse(await res.json());
    },
  });
}
