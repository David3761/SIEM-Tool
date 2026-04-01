import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ToggleLeft, ToggleRight, Save } from "lucide-react";
import { getConfig, updateConfig } from "../api/config";
import { getRules, createRule, updateRule, deleteRule } from "../api/rules";
import type { Rule } from "../types";
import { SeverityBadge } from "../components/shared/SeverityBadge";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import toast from "react-hot-toast";

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (vals: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const v = input.trim();
    if (v && !values.includes(v)) {
      onChange([...values, v]);
    }
    setInput("");
  };

  const remove = (val: string) => onChange(values.filter((v) => v !== val));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1 px-2 py-0.5 bg-slate-700 border border-slate-600 rounded text-xs font-mono text-slate-200"
          >
            {v}
            <button
              onClick={() => remove(v)}
              className="text-slate-500 hover:text-red-400 transition-colors ml-0.5"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"
        />
        <button
          onClick={add}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-md text-sm font-mono text-slate-300 transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

const RULE_DEFAULTS = {
  name: "",
  description: "",
  rule_type: "threshold",
  severity: "medium" as Rule["severity"],
  config: {},
  enabled: true,
};

export const Settings: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["config"],
    queryFn: getConfig,
  });

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ["rules"],
    queryFn: getRules,
  });

  const [interfaces, setInterfaces] = useState<string[]>([]);
  const [subnets, setSubnets] = useState<string[]>([]);
  const [excludedIps, setExcludedIps] = useState<string[]>([]);

  useEffect(() => {
    if (config) {
      setInterfaces(config.monitored_interfaces);
      setSubnets(config.monitored_subnets);
      setExcludedIps(config.excluded_ips);
    }
  }, [config]);

  const configMutation = useMutation({
    mutationFn: () =>
      updateConfig({
        monitored_interfaces: interfaces,
        monitored_subnets: subnets,
        excluded_ips: excludedIps,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config"] });
      toast.success("Configuration saved");
    },
    onError: () => toast.error("Failed to save configuration"),
  });

  // New rule form
  const [showNewRule, setShowNewRule] = useState(false);
  const [newRule, setNewRule] = useState(RULE_DEFAULTS);

  const createMutation = useMutation({
    mutationFn: () => createRule(newRule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      setNewRule(RULE_DEFAULTS);
      setShowNewRule(false);
      toast.success("Rule created");
    },
    onError: () => toast.error("Failed to create rule"),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateRule(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rules"] }),
    onError: () => toast.error("Failed to update rule"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rules"] });
      toast.success("Rule deleted");
    },
    onError: () => toast.error("Failed to delete rule"),
  });

  const inputClass =
    "w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50";

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Monitoring Config */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
        <h3 className="text-sm font-mono font-semibold text-slate-100 mb-5">
          Monitoring Configuration
        </h3>
        {configLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2">
                Monitored Interfaces
              </label>
              <TagInput
                values={interfaces}
                onChange={setInterfaces}
                placeholder="eth0, enter to add…"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2">
                Monitored Subnets
              </label>
              <TagInput
                values={subnets}
                onChange={setSubnets}
                placeholder="192.168.1.0/24, enter to add…"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2">
                Excluded IPs
              </label>
              <TagInput
                values={excludedIps}
                onChange={setExcludedIps}
                placeholder="10.0.0.1, enter to add…"
              />
            </div>
            <button
              onClick={() => configMutation.mutate()}
              disabled={configMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-md text-sm font-mono text-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {configMutation.isPending ? <LoadingSpinner size="sm" /> : <Save size={14} />}
              Save Configuration
            </button>
          </div>
        )}
      </div>

      {/* Rules */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-mono font-semibold text-slate-100">Detection Rules</h3>
          <button
            onClick={() => setShowNewRule((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-md text-xs font-mono text-cyan-400 transition-colors"
          >
            <Plus size={12} />
            New Rule
          </button>
        </div>

        {/* New rule form */}
        {showNewRule && (
          <div className="mb-5 p-4 bg-slate-900/60 rounded-lg border border-slate-700 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono text-slate-500 block mb-1">Name</label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule((r) => ({ ...r, name: e.target.value }))}
                  placeholder="Rule name"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-mono text-slate-500 block mb-1">Type</label>
                <input
                  type="text"
                  value={newRule.rule_type}
                  onChange={(e) => setNewRule((r) => ({ ...r, rule_type: e.target.value }))}
                  placeholder="threshold"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-mono text-slate-500 block mb-1">Description</label>
              <input
                type="text"
                value={newRule.description}
                onChange={(e) => setNewRule((r) => ({ ...r, description: e.target.value }))}
                placeholder="What does this rule detect?"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs font-mono text-slate-500 block mb-1">Severity</label>
              <select
                value={newRule.severity}
                onChange={(e) => setNewRule((r) => ({ ...r, severity: e.target.value as Rule["severity"] }))}
                className={inputClass}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !newRule.name}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-md text-xs font-mono text-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createMutation.isPending ? <LoadingSpinner size="sm" /> : <Plus size={12} />}
                Create Rule
              </button>
              <button
                onClick={() => setShowNewRule(false)}
                className="px-3 py-1.5 rounded-md text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Rules table */}
        {rulesLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : !rules || rules.length === 0 ? (
          <p className="text-center py-8 text-slate-600 font-mono text-sm">No rules configured</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                {["Severity", "Name", "Type", "Enabled", ""].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <SeverityBadge severity={rule.severity} />
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="text-sm font-mono text-slate-200">{rule.name}</p>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">{rule.description}</p>
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono text-slate-400">{rule.rule_type}</td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })}
                      className={`transition-colors ${rule.enabled ? "text-cyan-400" : "text-slate-600"}`}
                    >
                      {rule.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => {
                        if (confirm("Delete this rule?")) deleteMutation.mutate(rule.id);
                      }}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
