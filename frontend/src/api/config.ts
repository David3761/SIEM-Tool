import client from "./client";
import type { MonitoringConfig } from "../types";

export const getConfig = async (): Promise<MonitoringConfig> => {
  const { data } = await client.get("/api/config");
  return data;
};

export const updateConfig = async (
  config: Omit<MonitoringConfig, "updated_at">
): Promise<MonitoringConfig> => {
  const { data } = await client.put("/api/config", config);
  return data;
};
