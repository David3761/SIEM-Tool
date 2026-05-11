import { useState, useEffect } from "react";

const KEY = "siem:dns_lookup";
const EVENT = "siem:dns-change";

export function useDnsSetting(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(KEY) === "true");

  const set = (v: boolean) => {
    localStorage.setItem(KEY, String(v));
    window.dispatchEvent(new CustomEvent(EVENT));
    setEnabled(v);
  };

  useEffect(() => {
    const handler = () => setEnabled(localStorage.getItem(KEY) === "true");
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  return [enabled, set];
}
