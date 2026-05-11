import client from "./client";

export const getDnsHostname = async (ip: string): Promise<string | null> => {
  const { data } = await client.get("/api/dns", { params: { ip } });
  return data.hostname ?? null;
};
