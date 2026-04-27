import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, AreaChart, Area, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from 'recharts';
import { ArrowLeft, Download, TrendingUp, Zap, Users, Target, MessageSquare, BarChart2, FileText, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { AppBackground } from '../components/ui/AppBackground';
import { DataChat } from '../components/DataChat';
import { ExecutiveSummary } from '../components/ExecutiveSummary';
import { StrategyCard, StrategyDetail } from '../components/StrategyCard';
import type { Strategy } from '../components/StrategyCard';
import { fetchWithAuth, getAuthHeaders } from '../utils/api';

interface ChartData { labels: string[]; values: number[] }
interface ScatterPoint { name: string; data: [number, number, string][] }
interface SeasonalData { labels: string[]; datasets: { label: string; data: number[] }[] }
interface RFMScore {
  Segment_Name: string; Count: number;
  R_Score: number; F_Score: number; M_Score: number;
  Recency: number; Frequency: number; Monetary: number;
}

interface OptimizerCandidate {
  model?: string;
  params?: Record<string, unknown>;
  composite_score?: number;
  silhouette?: number | null;
  guardrails_ok?: boolean;
}

interface OptimizerStatus {
  status?: 'queued' | 'running' | 'done' | 'failed' | 'unknown';
  dataset_id?: number;
  recommend_upgrade?: boolean;
  score_gain?: number;
  winner?: OptimizerCandidate | null;
  top_candidates?: OptimizerCandidate[];
  recommendation_reason?: string;
  error?: string;
}

const COLORS = ['#FFFFFF', '#A3A3A3', '#525252', '#3B82F6', '#10B981'];
const tooltipStyle = {
  backgroundColor: '#0A0A0A', border: '1px solid #262626',
  borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
};

type Tab = 'overview' | 'rfm' | 'agent' | 'chat' | 'summary';

const TAB_ITEMS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview',          icon: BarChart2 },
  { id: 'rfm',      label: 'RFM Analysis',      icon: Target },
  { id: 'agent',    label: 'AI Agent',          icon: Sparkles },
  { id: 'chat',     label: 'Ask Your Data',     icon: MessageSquare },
  { id: 'summary',  label: 'Executive Summary', icon: FileText },
];

const Visualization = () => {
  const API_URL = import.meta.env.VITE_API_URL;
  const { dataset_id } = useParams<{ dataset_id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // ── Strategy Agent state ──────────────────────────────────────────────────
  const [strategies, setStrategies] = useState<Record<number, Strategy>>({});
  const [loadingSegments, setLoadingSegments] = useState<Set<number>>(new Set());
  const [expandedSegment, setExpandedSegment] = useState<number | null>(null);

  const fetchStrategy = async (segmentId: number) => {
    setLoadingSegments(prev => new Set(prev).add(segmentId));
    try {
      const res = await fetch(`${API_URL}/api/strategy/${dataset_id}/${segmentId}`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setStrategies(prev => ({ ...prev, [segmentId]: data.strategy }));
      } else {
        console.error('Strategy error:', data.error);
      }
    } catch (err) {
      console.error('Strategy fetch failed:', err);
    } finally {
      setLoadingSegments(prev => { const s = new Set(prev); s.delete(segmentId); return s; });
    }
  };

  const [segmentData, setSegmentData]   = useState<ChartData | null>(null);
  const [spendingData, setSpendingData] = useState<ChartData | null>(null);
  const [scatterData, setScatterData]   = useState<ScatterPoint[] | null>(null);
  const [seasonalData, setSeasonalData] = useState<SeasonalData | null>(null);
  const [rfmScores, setRfmScores]       = useState<RFMScore[] | null>(null);
  const [isLoading, setIsLoading]       = useState(true);
  const [optimizer, setOptimizer]       = useState<OptimizerStatus | null>(null);
  const [optimizerApplyMsg, setOptimizerApplyMsg] = useState<string | null>(null);
  const [isApplyingOptimizer, setIsApplyingOptimizer] = useState(false);
  const [hasUpdatedResultsPendingLoad, setHasUpdatedResultsPendingLoad] = useState(false);

  const loadAnalyticsData = async () => {
    try {
      const [segRes, spendRes, scatterRes, seasonalRes, rfmRes] = await Promise.all([
        fetch(`${API_URL}/api/segment-counts/${dataset_id}`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/spending-by-segment/${dataset_id}`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/recency-value-scatter/${dataset_id}`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/seasonal-distribution/${dataset_id}`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/api/rfm-scores/${dataset_id}`, { headers: getAuthHeaders() }),
      ]);
      if (segRes.ok)      setSegmentData(await segRes.json());
      if (spendRes.ok)    setSpendingData(await spendRes.json());
      if (scatterRes.ok)  setScatterData(await scatterRes.json());
      if (seasonalRes.ok) setSeasonalData(await seasonalRes.json());
      if (rfmRes.ok)      setRfmScores(await rfmRes.json());
    } catch (err) {
      console.error('Fetch error', err);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await loadAnalyticsData();
      } catch (err) { console.error('Fetch error', err); }
      finally { setIsLoading(false); }
    })();
  }, [dataset_id, API_URL]);

  useEffect(() => {
    if (!dataset_id) return;
    let cancelled = false;
    let timer: number | undefined;

    const pollOptimizer = async () => {
      try {
        const res = await fetchWithAuth(`/api/model-optimizer/status/${dataset_id}`);
        if (!res.ok) return;
        const data = (await res.json()) as OptimizerStatus;
        if (cancelled) return;
        setOptimizer(data);

        const status = data.status;
        if (status === 'queued' || status === 'running') {
          timer = window.setTimeout(pollOptimizer, 4000);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Optimizer status poll failed', err);
        }
      }
    };

    pollOptimizer();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [dataset_id]);

  const handleApplyOptimizer = async () => {
    if (!dataset_id) return;
    setOptimizerApplyMsg(null);
    setIsApplyingOptimizer(true);
    try {
      const res = await fetchWithAuth(`/api/model-optimizer/apply/${dataset_id}`, { method: 'POST' });
      const data = await res.json();
      setOptimizerApplyMsg(data?.message || 'Optimizer response received.');
      if (res.ok && data?.applied) {
        setHasUpdatedResultsPendingLoad(true);
      }
      // Refresh status after apply action.
      const s = await fetchWithAuth(`/api/model-optimizer/status/${dataset_id}`);
      if (s.ok) {
        setOptimizer(await s.json());
      }
    } catch (err) {
      console.error('Apply optimizer failed', err);
      setOptimizerApplyMsg('Failed to apply optimizer recommendation.');
    } finally {
      setIsApplyingOptimizer(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-6 h-6 border-2 border-neutral-800 border-t-white rounded-full animate-spin" />
          <div className="text-neutral-500 font-medium text-sm">Processing Data Model</div>
        </div>
      </div>
    );
  }

  const pieData = (segmentData?.labels ?? []).map((label, i) => ({ name: label, value: segmentData!.values[i] }));
  const barData = (spendingData?.labels ?? []).map((label, i) => ({ name: label, value: spendingData!.values[i] }));
  const seasonalChartData = (seasonalData?.labels ?? []).map((month, i) => {
    const entry: Record<string, string | number> = { name: month };
    seasonalData!.datasets.forEach(ds => { entry[ds.label] = ds.data[i]; });
    return entry;
  });

  const totalCustomers = pieData.reduce((a, b) => a + b.value, 0);
  const avgSpend = barData.length ? barData.reduce((a, b) => a + b.value, 0) / barData.length : 0;
  return (
    <div className="relative min-h-screen bg-black text-neutral-200 font-sans selection:bg-white/20 overflow-hidden">
      <AppBackground />
      <div className="relative z-10 p-6 md:p-12">

        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-8">
          <div className="space-y-4">
            <Link to="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-neutral-300 transition-all text-sm font-medium group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back
            </Link>
            <div className="space-y-1">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white">Customer Analytics</h1>
              <p className="text-neutral-500 font-medium flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Dataset: <span className="font-mono text-neutral-400">{dataset_id}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a href={`${API_URL}/download`} className="px-5 py-2.5 rounded-lg bg-white text-black hover:bg-neutral-200 transition-all font-medium text-sm flex items-center gap-2">
              <Download className="w-4 h-4" /> Export CSV
            </a>
          </div>
        </header>

        {/* Stats Row */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Customers',       value: totalCustomers.toLocaleString(), icon: Users },
            { label: 'Segments',        value: pieData.length,                  icon: Target },
            { label: 'Avg Spend',       value: `$${Math.round(avgSpend).toLocaleString()}`, icon: TrendingUp },
            { label: 'RFM Features',    value: '3 (R·F·M)',                     icon: Zap },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="glass-card p-5 rounded-2xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-neutral-500">{stat.label}</p>
                <stat.icon className="w-3.5 h-3.5 text-neutral-600" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-white">{stat.value}</h3>
            </motion.div>
          ))}
        </section>

        {/* Optimizer Notification */}
        {optimizer && (
          <section className={`mb-8 rounded-2xl border p-4 md:p-5 ${
            optimizer.status === 'failed'
              ? 'border-red-900/60 bg-red-950/30'
              : optimizer.recommend_upgrade
              ? 'border-emerald-900/60 bg-emerald-950/25'
              : 'border-white/10 bg-white/5'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">Model Optimizer</p>
                {optimizer.status === 'queued' || optimizer.status === 'running' ? (
                  <p className="text-sm text-neutral-300">
                    Evaluating alternate models in background...
                  </p>
                ) : optimizer.status === 'failed' ? (
                  <p className="text-sm text-red-300">
                    Optimizer failed: {optimizer.error || 'Unknown error'}
                  </p>
                ) : optimizer.recommend_upgrade ? (
                  <p className="text-sm text-emerald-300">
                    Better model found ({optimizer.winner?.model ?? 'candidate'}) with
                    {' '}+{(((optimizer.score_gain ?? 0) * 100)).toFixed(1)} score lift.
                  </p>
                ) : (
                  <p className="text-sm text-neutral-300">
                    Baseline segmentation remains best for this dataset.
                  </p>
                )}
                {optimizer.status === 'done' && optimizer.winner && (
                  <p className="text-xs text-neutral-500 mt-1">
                    Winner: {optimizer.winner.model ?? 'n/a'}
                    {optimizer.winner.silhouette != null ? ` · silhouette ${optimizer.winner.silhouette.toFixed(3)}` : ''}
                  </p>
                )}
                {optimizer.status === 'done' && optimizer.winner && (
                  <div className="mt-3">
                    <span className={`px-2 py-0.5 rounded-md border text-[11px] ${
                      optimizer.recommend_upgrade
                        ? 'border-emerald-700/50 text-emerald-300 bg-emerald-500/10'
                        : 'border-neutral-700 text-neutral-300 bg-white/5'
                    }`}>
                      {optimizer.recommend_upgrade ? 'Recommendation available' : 'Baseline retained'}
                    </span>
                  </div>
                )}
                {optimizerApplyMsg && (
                  <p className="text-xs text-neutral-400 mt-2">{optimizerApplyMsg}</p>
                )}
                {hasUpdatedResultsPendingLoad && (
                  <button
                    onClick={async () => {
                      setIsLoading(true);
                      await loadAnalyticsData();
                      setIsLoading(false);
                      setHasUpdatedResultsPendingLoad(false);
                      setOptimizerApplyMsg('Updated results loaded.');
                    }}
                    className="mt-3 px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs text-white transition"
                  >
                    Load Updated Results
                  </button>
                )}
              </div>
              {optimizer.status === 'done' && optimizer.recommend_upgrade && (
                <button
                  onClick={handleApplyOptimizer}
                  disabled={isApplyingOptimizer}
                  className="px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-500/25 transition disabled:opacity-60 text-sm font-medium"
                >
                  {isApplyingOptimizer ? 'Applying...' : 'Apply Recommendation'}
                </button>
              )}
            </div>
          </section>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-8 p-1 glass-card rounded-xl w-fit">
          {TAB_ITEMS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white border border-white/10'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB: OVERVIEW ──────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Left — 2 big charts */}
              <div className="lg:col-span-2 space-y-6">
                {/* Bar Chart */}
                <div className="glass-card rounded-[2rem] p-8">
                  <div className="mb-6 space-y-1">
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest">Expenditure</p>
                    <h2 className="text-lg font-semibold text-white">Average Monetary Value by Segment</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <BarChart width={640} height={280} data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 11 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 11 }} tickFormatter={v => `$${v}`} dx={-8} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={tooltipStyle}
                        labelStyle={{ color: '#FAFAFA', fontWeight: 600 }} itemStyle={{ color: '#A3A3A3', fontSize: '13px' }}
                        formatter={val => [`$${val}`, 'Avg Spend']} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {barData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </div>
                </div>

                {/* Scatter Chart */}
                <div className="glass-card rounded-[2rem] p-8">
                  <div className="mb-6 space-y-1">
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest">Lifecycle</p>
                    <h2 className="text-lg font-semibold text-white">Recency vs Monetary Value</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <ScatterChart width={640} height={280} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                      <XAxis type="number" dataKey="x" name="Recency" unit="d" reversed axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 11 }} />
                      <YAxis type="number" dataKey="y" name="Spend" unit="$" axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 11 }} />
                      <ZAxis type="number" range={[40, 200]} />
                      <Tooltip cursor={{ strokeDasharray: '3 3', stroke: '#404040' }} contentStyle={tooltipStyle}
                        labelStyle={{ color: '#FAFAFA' }} itemStyle={{ color: '#A3A3A3', fontSize: '13px' }} />
                      <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ color: '#737373', fontSize: 12, paddingBottom: '16px' }} />
                      {(scatterData ?? []).map((seg, idx) => (
                        <Scatter key={seg.name} name={seg.name}
                          data={seg.data.map(p => ({ x: p[0], y: p[1], z: 1 }))}
                          fill={COLORS[idx % COLORS.length]} fillOpacity={0.8} />
                      ))}
                    </ScatterChart>
                  </div>
                </div>
              </div>

              {/* Right sidebar */}
              <div className="space-y-6">
                {/* Pie */}
                <div className="glass-card rounded-[2rem] p-8">
                  <h3 className="text-base font-semibold text-white mb-1">Segment Distribution</h3>
                  <p className="text-xs text-neutral-500 mb-6">Customer base composition</p>
                  <div className="flex justify-center mb-6">
                    <PieChart width={200} height={200}>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={2} dataKey="value" strokeWidth={0}>
                        {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#A3A3A3', fontSize: '13px' }} />
                    </PieChart>
                  </div>
                  <div className="space-y-2.5">
                    {pieData.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                          <span className="text-sm font-medium text-neutral-300">{entry.name}</span>
                        </div>
                        <span className="text-sm text-neutral-500">{entry.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Seasonal Area */}
                <div className="glass-card rounded-[2rem] p-8">
                  <h3 className="text-base font-semibold text-white mb-1">Seasonal Trends</h3>
                  <p className="text-xs text-neutral-500 mb-6">Purchase patterns by season</p>
                  <AreaChart width={260} height={160} data={seasonalChartData}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#FAFAFA' }} itemStyle={{ fontSize: '12px' }} />
                    {(seasonalData?.datasets ?? []).map((ds, i) => (
                      <Area key={ds.label} type="monotone" dataKey={ds.label}
                        stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.05} strokeWidth={2} />
                    ))}
                  </AreaChart>
                </div>
              </div>
            </div>

          </motion.div>
        )}

        {/* ── TAB: RFM ANALYSIS ─────────────────────────────────────────────── */}
        {activeTab === 'rfm' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* RFM Score Heatmap */}
              <div className="glass-card rounded-[2rem] p-8">
                <div className="mb-6">
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-1">RFM Scores</p>
                  <h2 className="text-lg font-semibold text-white">Average R·F·M per Segment</h2>
                </div>
                {rfmScores?.map((seg, i) => (
                  <div key={i} className="mb-6 last:mb-0">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-sm font-medium text-neutral-200">{seg.Segment_Name}</span>
                      </div>
                      <span className="text-xs text-neutral-500">{seg.Count} customers</span>
                    </div>
                    {[
                      { label: 'Recency Score', value: seg.R_Score, raw: `${Math.round(seg.Recency)}d ago` },
                      { label: 'Frequency Score', value: seg.F_Score, raw: `${seg.Frequency.toFixed(1)} purchases` },
                      { label: 'Monetary Score', value: seg.M_Score, raw: `$${Math.round(seg.Monetary).toLocaleString()}` },
                    ].map(metric => (
                      <div key={metric.label} className="flex items-center gap-3 mb-2">
                        <span className="text-xs text-neutral-500 w-28 flex-shrink-0">{metric.label}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full rfm-bar" style={{ width: `${(metric.value / 5) * 100}%`, backgroundColor: COLORS[i % COLORS.length], opacity: 0.7 }} />
                        </div>
                        <span className="text-xs font-medium text-neutral-300 w-5 text-right">{metric.value.toFixed(1)}</span>
                        <span className="text-xs text-neutral-600 w-28 text-right hidden md:block">{metric.raw}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Radar Chart */}
              <div className="glass-card rounded-[2rem] p-8">
                <div className="mb-6">
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-1">Radar View</p>
                  <h2 className="text-lg font-semibold text-white">RFM Profile Comparison</h2>
                </div>
                <div className="flex justify-center">
                  <RadarChart cx={240} cy={180} outerRadius={120} width={480} height={340}
                    data={[
                      { axis: 'Recency',   ...Object.fromEntries((rfmScores ?? []).map(s => [s.Segment_Name, s.R_Score])) },
                      { axis: 'Frequency', ...Object.fromEntries((rfmScores ?? []).map(s => [s.Segment_Name, s.F_Score])) },
                      { axis: 'Monetary',  ...Object.fromEntries((rfmScores ?? []).map(s => [s.Segment_Name, s.M_Score])) },
                    ]}>
                    <PolarGrid stroke="#262626" />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: '#737373', fontSize: 12 }} />
                    <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#A3A3A3', fontSize: '12px' }} />
                    <Legend iconType="circle" wrapperStyle={{ color: '#737373', fontSize: 12 }} />
                    {(rfmScores ?? []).map((seg, i) => (
                      <Radar key={seg.Segment_Name} name={seg.Segment_Name} dataKey={seg.Segment_Name}
                        stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]}
                        fillOpacity={0.08} strokeWidth={1.5} />
                    ))}
                  </RadarChart>
                </div>
              </div>
            </div>

            {/* Segment Stats Table */}
            <div className="glass-card rounded-[2rem] p-8">
              <div className="mb-6">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-1">Detailed Stats</p>
                <h2 className="text-lg font-semibold text-white">Segment Metrics Table</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['Segment', 'Customers', 'Avg Recency', 'Avg Frequency', 'Avg Monetary', 'R', 'F', 'M'].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-neutral-500 pb-3 pr-6">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rfmScores?.map((seg, i) => (
                      <tr key={i} className="border-b border-white/3 hover:bg-white/2 transition-colors">
                        <td className="py-3 pr-6">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            <span className="font-medium text-neutral-200">{seg.Segment_Name}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-6 text-neutral-400">{seg.Count.toLocaleString()}</td>
                        <td className="py-3 pr-6 text-neutral-400">{Math.round(seg.Recency)}d</td>
                        <td className="py-3 pr-6 text-neutral-400">{seg.Frequency.toFixed(1)}×</td>
                        <td className="py-3 pr-6 text-neutral-400">${Math.round(seg.Monetary).toLocaleString()}</td>
                        {[seg.R_Score, seg.F_Score, seg.M_Score].map((score, si) => (
                          <td key={si} className="py-3 pr-6">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${score >= 4 ? 'bg-white/10 text-white' : score >= 3 ? 'bg-white/5 text-neutral-300' : 'bg-white/3 text-neutral-500'}`}>
                              {score.toFixed(1)}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── TAB: AGENT ────────────────────────────────────────────────────── */}
        {activeTab === 'agent' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-[600px]">
              
              {/* Left Column: List of Segments */}
              <div className="lg:col-span-4 space-y-4">
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-1">STRATEGY AGENT</p>
                  <h2 className="text-2xl font-bold text-white mb-4">Segments</h2>
                </div>
                <div className="space-y-3 pr-2">
                  {pieData.map((segment, idx) => {
                    const name = segment.name.toLowerCase();
                    let strategy = 'Maintain regular engagement with personalised content and standard promotional offers.';
                    let campaign = 'Standard Engagement';
                    if (name.includes('champion') || name.includes('vip')) {
                      strategy = 'Provide VIP perks, early access, and dedicated account management to retain high-value customers.';
                      campaign = 'VIP Retention';
                    } else if (name.includes('loyal')) {
                      strategy = 'Upsell complementary products, offer referral bonuses, and request product reviews.';
                      campaign = 'Loyalty Upsell';
                    } else if (name.includes('risk') || name.includes('lost')) {
                      strategy = 'Deploy aggressive win-back campaigns, high-value discounts, and satisfaction surveys.';
                      campaign = 'Win-Back';
                    } else if (name.includes('potential') || name.includes('new')) {
                      strategy = 'Trigger welcome automation, offer first-time buyer discounts, highlight popular products.';
                      campaign = 'Nurture';
                    }
                    // map segment name → cluster id for strategy fetching
                    const clusterIdByName: Record<string, number> = {
                      'low-value frequent buyers': 0,
                      'high-value loyal customers': 1,
                      'lost customers': 2,
                      'seasonal buyers': 3,
                    };
                    const segClusterId = clusterIdByName[segment.name.toLowerCase()] ?? idx;
                    const isStratLoading = loadingSegments.has(segClusterId);
                    const segStrategy   = strategies[segClusterId];
                    
                    // Auto-select first item if none selected
                    const isExpanded = expandedSegment === segClusterId || (expandedSegment === null && idx === 0);

                    return (
                      <StrategyCard
                        key={idx}
                        idx={idx}
                        segmentId={segClusterId}
                        segmentName={segment.name}
                        segmentValue={segment.value}
                        defaultCampaign={campaign}
                        defaultStrategy={strategy}
                        strategy={segStrategy}
                        isLoading={isStratLoading}
                        isExpanded={isExpanded}
                        onToggle={() => setExpandedSegment(segClusterId)}
                        onGenerate={(e) => {
                          e.stopPropagation();
                          fetchStrategy(segClusterId);
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Detail View */}
              <div className="lg:col-span-8">
                {(() => {
                  const activeIdx = pieData.findIndex((seg, idx) => {
                    const clusterIdByName: Record<string, number> = {
                      'low-value frequent buyers': 0,
                      'high-value loyal customers': 1,
                      'lost customers': 2,
                      'seasonal buyers': 3,
                    };
                    const segClusterId = clusterIdByName[seg.name.toLowerCase()] ?? idx;
                    return expandedSegment === segClusterId || (expandedSegment === null && idx === 0);
                  });

                  if (activeIdx === -1) return null;

                  const segment = pieData[activeIdx];
                  const clusterIdByName: Record<string, number> = {
                    'low-value frequent buyers': 0,
                    'high-value loyal customers': 1,
                    'lost customers': 2,
                    'seasonal buyers': 3,
                  };
                  const segClusterId = clusterIdByName[segment.name.toLowerCase()] ?? activeIdx;
                  const isStratLoading = loadingSegments.has(segClusterId);
                  const segStrategy = strategies[segClusterId];

                  return (
                    <StrategyDetail
                      segmentName={segment.name}
                      strategy={segStrategy}
                      isLoading={isStratLoading}
                      onGenerate={() => fetchStrategy(segClusterId)}
                    />
                  );
                })()}
              </div>

            </div>
          </motion.div>
        )}

        {/* ── TAB: CHAT ─────────────────────────────────────────────────────── */}
        {activeTab === 'chat' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="max-w-3xl mx-auto">
              <DataChat datasetId={dataset_id} apiUrl={API_URL} />
            </div>
          </motion.div>
        )}

        {/* ── TAB: EXECUTIVE SUMMARY ────────────────────────────────────────── */}
        {activeTab === 'summary' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ExecutiveSummary datasetId={dataset_id} apiUrl={API_URL} />
          </motion.div>
        )}

        {/* Footer */}
        <footer className="mt-16 py-8 border-t border-neutral-900 flex justify-between items-center text-neutral-500 text-xs">
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-neutral-300 transition-colors">Home</Link>
            <a href={`${API_URL}/download`} className="hover:text-neutral-300 transition-colors">Download CSV</a>
          </div>
          <span>CUE-X Analytics · RFM Engine v2</span>
        </footer>

      </div>
    </div>
  );
};

export default Visualization;
