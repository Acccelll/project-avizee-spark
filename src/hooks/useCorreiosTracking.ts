import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchTracking, type CorreiosTrackingResponse } from "@/services/correios.service";

interface UseCorreiosTrackingReturn {
  data: CorreiosTrackingResponse | undefined;
  isLoading: boolean;
  error: Error | null;
  isMock: boolean;
  track: (codigo: string) => void;
}

export function useCorreiosTracking(): UseCorreiosTrackingReturn {
  const [codigo, setCodigo] = useState<string | null>(null);

  const query = useQuery<CorreiosTrackingResponse, Error>({
    queryKey: ["correios-tracking", codigo],
    queryFn: () => fetchTracking(codigo!),
    enabled: !!codigo,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const isMock = query.data?.warning === "fallback_mock";

  return {
    data: query.data,
    isLoading: query.isFetching,
    error: query.error,
    isMock,
    track: setCodigo,
  };
}
