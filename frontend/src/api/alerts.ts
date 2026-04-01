import client from "./client";
import type { Alert, PaginatedResponse } from "../types";

export interface AlertsParams {
  page?: number;
  limit?: number;
  severity?: string;
  status?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}

export const getAlerts = async (params?: AlertsParams): Promise<PaginatedResponse<Alert>> => {
  const { data } = await client.get("/api/alerts", { params });
  return data;
};

export const getAlert = async (id: string): Promise<Alert> => {
  const { data } = await client.get(`/api/alerts/${id}`);
  return data;
};

export const updateAlertStatus = async (
  id: string,
  status: Alert["status"]
): Promise<Alert> => {
  const { data } = await client.patch(`/api/alerts/${id}`, { status });
  return data;
};

export const exportAlerts = async (
  format: "csv" | "pdf",
  params?: AlertsParams
): Promise<Blob> => {
  const { data } = await client.get("/api/alerts/export", {
    params: { format, ...params },
    responseType: "blob",
  });
  return data;
};
