import client from "./client";
import type { StatsResponse } from "../types";

export const getStats = async (range: string = "1h"): Promise<StatsResponse> => {
  const { data } = await client.get("/api/stats", { params: { range } });
  return data;
};
