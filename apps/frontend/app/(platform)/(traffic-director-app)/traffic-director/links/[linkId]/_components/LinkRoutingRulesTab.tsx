"use client";

import React from 'react';
import { 
  Layers, ArrowUp, ArrowDown, 
  Power, Trash2, ExternalLink, Plus 
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { ensureExternalUrl } from '@/lib/url';

export interface LinkRoutingRulesTabProps {
  linkId: string;
  linkData: any;
  shieldMode?: 'server' | 'client_shield';
  setShieldMode?: (mode: 'server' | 'client_shield') => void;
  datacenterBlocked?: boolean;
  setDatacenterBlocked?: (val: boolean) => void;
  blockSpyServices?: boolean;
  setBlockSpyServices?: (val: boolean) => void;
  blockVpn?: boolean;
  setBlockVpn?: (val: boolean) => void;
  warmupUntil?: string;
  setWarmupUntil?: (val: string) => void;
  rampUpEnabled?: boolean;
  setRampUpEnabled?: (val: boolean) => void;
  rampUpDurationHours?: number;
  setRampUpDurationHours?: (val: number) => void;
  savingShield?: boolean;
  handleUpdateShieldSettings?: () => Promise<void>;
  fallbackUrl?: string;
  setFallbackUrl?: (val: string) => void;
  safePageProxyMode?: boolean;
  setSafePageProxyMode?: (val: boolean) => void;
  savingFallback?: boolean;
  handleUpdateFallback?: () => Promise<void>;
  handleMoveRule: (index: number, direction: 'up' | 'down') => Promise<void>;
  handleToggleRuleActive: (rule: any) => Promise<void>;
  setEditingRule: (rule: any) => void;
  setDeleteRuleConfirm: (val: { isOpen: boolean; rule: any; loading: boolean }) => void;
  setIsRuleModalOpen: (open: boolean) => void;
  setIsEmbedModalOpen?: (open: boolean) => void;
}

export default function LinkRoutingRulesTab({
  linkId,
  linkData,
  handleMoveRule,
  handleToggleRuleActive,
  setEditingRule,
  setDeleteRuleConfirm,
  setIsRuleModalOpen,
  setIsEmbedModalOpen,
}: LinkRoutingRulesTabProps) {
  return (
    <div className="space-y-6">
      {/* Rules Decision Sequence Banner */}
      <div className="p-3 px-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Priority Matrix Evaluation (Top-to-Bottom)</span>
            <InfoTooltip content="Requests are evaluated against each rule in sequence. The first rule whose complete condition set matches will handle the redirect. If no rules match, the request will drop through to the default Fallback Target." />
          </div>
        </div>
      </div>

      {/* Rule Canvas List */}
      <div className="space-y-4">
        {linkData.rules && linkData.rules.length > 0 ? (
          linkData.rules.map((rule: any, index: number) => {
            let conditions = [];
            try {
              conditions = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
            } catch (e) {
              conditions = [];
            }

            return (
              <div
                key={rule.id}
                className={`p-6 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border transition shadow-sm ${
                  rule.isActive ? 'border-gray-200 dark:border-white/10' : 'border-gray-200/80 dark:border-white/10/40 opacity-60'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-mono text-[11px] font-bold">
                        #{index + 1} Priority
                      </span>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">{rule.name}</h3>
                      <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 text-[10px] font-semibold uppercase">
                        {rule.actionType}
                      </span>
                      {rule.weight < 100 && (
                        <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                          Split: {rule.weight}%
                        </span>
                      )}
                    </div>

                    {/* Conditions Pill Bar */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">IF:</span>
                      {conditions.length > 0 ? (
                        conditions.map((c: any, cIdx: number) => {
                          const configMap: Record<string, { label: string }> = {
                            os: { label: 'OS' },
                            device_type: { label: 'Device' },
                            bot_status: { label: 'Bot Status' },
                            sec_ch_ua: { label: 'Client Hints' },
                            gpu_renderer: { label: 'GPU' },
                            network_type: { label: 'Network' },
                            asn_provider: { label: 'Cloud ASN' },
                            geo_country: { label: 'Country' },
                            geo_region: { label: 'Region' },
                            geo_city: { label: 'City' },
                            geo_postal_code: { label: 'Postal' },
                            geo_timezone: { label: 'Timezone' },
                            touch_support: { label: 'Touch Screen' },
                            battery_valid: { label: 'Battery' },
                            referrer: { label: 'Referrer' },
                            language: { label: 'Language' },
                            query_param: { label: 'Query' },
                            header: { label: 'Header' },
                          };

                          const opMap: Record<string, { symbol: string; isNegation: boolean }> = {
                            equals: { symbol: '=', isNegation: false },
                            not_equals: { symbol: '≠', isNegation: true },
                            in: { symbol: 'in', isNegation: false },
                            not_in: { symbol: 'not in', isNegation: true },
                            starts_with: { symbol: 'starts with', isNegation: false },
                            contains: { symbol: 'contains', isNegation: false },
                            not_contains: { symbol: 'excludes', isNegation: true },
                            regex: { symbol: 'regex', isNegation: false },
                          };

                          const config = configMap[c.type] || { label: c.type };
                          const opConfig = opMap[c.operator] || { symbol: c.operator, isNegation: false };
                          const rawValues = String(c.value || '').split(',').map((s: string) => s.trim()).filter(Boolean);

                          return (
                            <div
                              key={cIdx}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-2xs transition ${
                                opConfig.isNegation
                                  ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200/70 dark:border-rose-900/50 text-rose-900 dark:text-rose-200'
                                  : 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200/70 dark:border-indigo-900/50 text-indigo-900 dark:text-indigo-200'
                              }`}
                            >
                              <span className="font-semibold text-gray-700 dark:text-gray-300">
                                {c.key ? `${config.label}(${c.key})` : config.label}
                              </span>
                              <span className={`font-mono text-[11px] font-bold ${opConfig.isNegation ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                {opConfig.symbol}
                              </span>

                              {/* Value badges */}
                              {rawValues.length <= 2 ? (
                                <div className="flex items-center gap-1">
                                  {rawValues.map((v: string, vIdx: number) => (
                                    <span
                                      key={vIdx}
                                      className={`px-1.5 py-0.5 rounded font-mono font-bold text-[11px] ${
                                        opConfig.isNegation
                                          ? 'bg-rose-100/70 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200'
                                          : 'bg-indigo-100/70 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200'
                                      }`}
                                    >
                                      {v}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1" title={rawValues.join(', ')}>
                                  <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[11px] ${
                                    opConfig.isNegation
                                      ? 'bg-rose-100/70 dark:bg-rose-900/50 text-rose-800 dark:text-rose-200'
                                      : 'bg-indigo-100/70 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200'
                                  }`}>
                                    {rawValues.slice(0, 2).join(', ')}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-gray-200/70 dark:bg-gray-700/70 text-[10px] font-bold text-gray-700 dark:text-gray-300">
                                    +{rawValues.length - 2} more
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-xs text-gray-400 italic">No conditions (Matches all traffic)</span>
                      )}
                    </div>

                    {/* Destination URL */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-gray-400 uppercase">THEN ROUTE TO:</span>
                      <a
                        href={ensureExternalUrl(rule.destinationUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 truncate max-w-md"
                      >
                        {rule.destinationUrl}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Actions & Priority Shift */}
                  <div className="flex items-center gap-2 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-200/80 dark:border-white/10">
                    <div className="flex items-center rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-gray-800 p-1">
                      <button
                        onClick={() => handleMoveRule(index, 'up')}
                        disabled={index === 0}
                        className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveRule(index, 'down')}
                        disabled={index === linkData.rules.length - 1}
                        className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleToggleRuleActive(rule)}
                      className={`p-2.5 rounded-xl border transition ${
                        rule.isActive
                          ? 'border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                          : 'border-gray-200 dark:border-zinc-800 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                      title={rule.isActive ? 'Disable Rule' : 'Enable Rule'}
                    >
                      <Power className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setEditingRule(rule)}
                      className="p-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 text-gray-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition"
                      title="Edit Rule Conditions & Target"
                    >
                      <Layers className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setDeleteRuleConfirm({ isOpen: true, rule, loading: false })}
                      className="p-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 text-gray-400 hover:text-rose-500 hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-gray-200/80 dark:border-white/10 space-y-3">
            <Layers className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No conditional rules added yet</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Add your first routing rule to redirect visitors matching specific countries, devices, or parameters.
            </p>
            <button
              onClick={() => setIsRuleModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add First Rule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

