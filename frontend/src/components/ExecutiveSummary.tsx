import { useEffect, useState } from 'react';
import { Loader2, TrendingUp, Users, DollarSign, BarChart2, Zap } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { motion } from 'framer-motion';

interface SegmentStat {
  name: string;
  count: number;
  revenue: number;
  revenue_pct: number;
  avg_spend: number;
  avg_recency: number;
  avg_freq: number;
  rfm_scores: { R: number; F: number; M: number };
  campaign: string;
}

interface SummaryData {
  headline: string;
  rule_headline: string;
  segments: SegmentStat[];
  key_findings: string[];
  recommended_actions: { priority: number; emoji: string; title: string; detail: string }[];
  stats: {
    total_customers: number;
    total_revenue: number;
    avg_order_value: number;
    num_segments: number;
  };
  ai_powered: boolean;
}

interface ExecutiveSummaryProps {
  datasetId: string | undefined;
  apiUrl: string;
}

const SEGMENT_COLORS: Record<string, string> = {
  Champions:             '#ffffff',
  'Loyal Customers':     '#a3a3a3',
  'Potential Loyalists': '#3b82f6',
  'At Risk / Lost':      '#ef4444',
  Hibernating:           '#525252',
  'Can\'t Lose Them':    '#f59e0b',
  Lost:                  '#dc2626',
};

function segmentColor(name: string) {
  for (const key of Object.keys(SEGMENT_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase().split(' ')[0]))
      return SEGMENT_COLORS[key];
  }
  return '#6b7280';
}

const RFMBar = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-neutral-500 w-3">{label}</span>
    <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
      <div
        className="h-full rounded-full rfm-bar"
        style={{ width: `${(value / 5) * 100}%`, background: 'rgba(255,255,255,0.4)' }}
      />
    </div>
    <span className="text-xs text-neutral-400 w-4 text-right">{value.toFixed(1)}</span>
  </div>
);

export const ExecutiveSummary = ({ datasetId, apiUrl }: ExecutiveSummaryProps) => {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!datasetId) return;
    (async () => {
      try {
        const res = await fetchWithAuth(`/api/executive-summary/${datasetId}`);
        if (!res.ok) throw new Error('Failed to fetch summary');
        const data = await res.json();
        setSummary(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load executive summary');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [datasetId, apiUrl]);

  if (isLoading) {
    return (
      <div className="glass-card rounded-[2rem] p-8 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-5 h-5 text-neutral-600 animate-spin" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="glass-card rounded-[2rem] p-8 text-center text-neutral-500 text-sm">
        {error || 'No summary data available.'}
      </div>
    );
  }

  const { headline, segments, key_findings, recommended_actions, stats, ai_powered } = summary;

  return (
    <div className="space-y-6">
      {/* Headline Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-[2rem] p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        <div className="flex items-start gap-3 mb-4">
          <Zap className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-widest">
                {ai_powered ? 'AI Executive Insight' : 'Executive Summary'}
              </span>
              {ai_powered && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-blue-500/30 text-blue-400">
                  Gemini
                </span>
              )}
            </div>
            <p className="text-base md:text-lg font-medium text-white leading-relaxed">{headline}</p>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/5">
          {[
            { label: 'Total Customers', value: stats.total_customers.toLocaleString(), icon: Users },
            { label: 'Segments Found',  value: stats.num_segments, icon: BarChart2 },
            { label: 'Total Revenue',   value: `$${stats.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign },
            { label: 'Avg Order Value', value: `$${Math.round(stats.avg_order_value).toLocaleString()}`, icon: TrendingUp },
          ].map((kpi, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-neutral-500">
                <kpi.icon className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{kpi.label}</span>
              </div>
              <span className="text-xl font-semibold text-white">{kpi.value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Segment Breakdown + Actions — 2 column */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Segment breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-[2rem] p-8 space-y-5"
        >
          <div>
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-1">Segment Breakdown</h3>
            <h2 className="text-lg font-semibold text-white">Revenue & RFM by Cluster</h2>
          </div>

          {segments.map((seg, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: segmentColor(seg.name) }}
                  />
                  <span className="text-sm font-medium text-neutral-200">{seg.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-neutral-500">
                  <span>{seg.count.toLocaleString()} customers</span>
                  <span className="font-medium text-neutral-300">{seg.revenue_pct}% rev</span>
                </div>
              </div>

              {/* Revenue bar */}
              <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full rfm-bar"
                  style={{ width: `${seg.revenue_pct}%`, backgroundColor: segmentColor(seg.name) }}
                />
              </div>

              {/* RFM mini-scores */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <RFMBar label="R" value={seg.rfm_scores.R} />
                <RFMBar label="F" value={seg.rfm_scores.F} />
                <RFMBar label="M" value={seg.rfm_scores.M} />
              </div>
            </div>
          ))}
        </motion.div>

        {/* Findings + Actions */}
        <div className="space-y-6">
          {/* Key Findings */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card rounded-[2rem] p-8 space-y-4"
          >
            <div>
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-1">Key Findings</h3>
              <h2 className="text-lg font-semibold text-white">Data-Driven Insights</h2>
            </div>
            <ul className="space-y-3">
              {key_findings.map((finding, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                  <p
                    className="text-sm text-neutral-400 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: finding.replace(/\*\*(.*?)\*\*/g, '<span class="text-white font-medium">$1</span>'),
                    }}
                  />
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Recommended Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-[2rem] p-8 space-y-4"
          >
            <div>
              <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-1">Action Plan</h3>
              <h2 className="text-lg font-semibold text-white">Recommended Priorities</h2>
            </div>
            <div className="space-y-4">
              {recommended_actions.map((action, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 border border-white/10"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {action.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white mb-0.5">
                      <span className="text-neutral-600 font-normal mr-2">#{action.priority}</span>
                      {action.title}
                    </p>
                    <p className="text-xs text-neutral-500 leading-relaxed">{action.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
