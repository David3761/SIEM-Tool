import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getDnsHostname } from "../../api/dns";
import { useDnsSetting } from "../../hooks/useDnsSetting";

interface IpLabelProps {
  ip: string;
}

export const IpLabel: React.FC<IpLabelProps> = ({ ip }) => {
  const [dnsEnabled] = useDnsSetting();

  const { data: hostname } = useQuery({
    queryKey: ["dns", ip],
    queryFn: () => getDnsHostname(ip),
    enabled: dnsEnabled && !!ip,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  return (
    <span className="inline-block">
      <span>{ip}</span>
      {dnsEnabled && hostname && (
        <span
          className="block text-slate-500 truncate max-w-[200px]"
          style={{ fontSize: "0.65rem" }}
          title={hostname}
        >
          {hostname}
        </span>
      )}
    </span>
  );
};
