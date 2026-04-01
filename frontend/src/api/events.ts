import client from "./client";
import type { NetworkEvent, PaginatedResponse } from "../types";

export interface EventsParams {
  page?: number;
  limit?: number;
  protocol?: string;
  direction?: string;
  src_ip?: string;
  dst_ip?: string;
  port?: number;
  search?: string;
}

export const getEvents = async (
  params?: EventsParams
): Promise<PaginatedResponse<NetworkEvent>> => {
  const { data } = await client.get("/api/events", { params });
  return data;
};
