import client from "./client";
import type { Incident } from "../types";

export const getIncidents = async (): Promise<Incident[]> => {
  const { data } = await client.get("/api/incidents");
  return data;
};

export const getIncident = async (id: string): Promise<Incident> => {
  const { data } = await client.get(`/api/incidents/${id}`);
  return data;
};

export const createIncident = async (incident: {
  title: string;
  description?: string;
  severity: Incident["severity"];
  alert_ids: string[];
}): Promise<Incident> => {
  const { data } = await client.post("/api/incidents", incident);
  return data;
};

export const updateIncident = async (
  id: string,
  updates: Partial<Pick<Incident, "status" | "title" | "description">>
): Promise<Incident> => {
  const { data } = await client.patch(`/api/incidents/${id}`, updates);
  return data;
};
