import client from "./client";
import type { Rule } from "../types";

export const getRules = async (): Promise<Rule[]> => {
  const { data } = await client.get("/api/rules");
  return data;
};

export const createRule = async (
  rule: Omit<Rule, "id" | "created_at">
): Promise<Rule> => {
  const { data } = await client.post("/api/rules", rule);
  return data;
};

export const updateRule = async (
  id: string,
  rule: Partial<Omit<Rule, "id" | "created_at">>
): Promise<Rule> => {
  const { data } = await client.put(`/api/rules/${id}`, rule);
  return data;
};

export const deleteRule = async (id: string): Promise<void> => {
  await client.delete(`/api/rules/${id}`);
};
