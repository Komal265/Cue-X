import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, AreaChart, Area, Legend
} from 'recharts';
import {
  ArrowLeft, Download, TrendingUp, Calendar, Zap,
  Users, PieChart as PieIcon, BarChart3, Target, MousePointer2
} from 'lucide-react';
import { motion } from 'framer-motion';

interface ChartData {
  labels: string[];
  values: number[];
}
interface ScatterPoint {
  name: string;
  data: [number, number, string][];
}
interface SeasonalData {
  labels: string[];
  datasets: { label: string; data: number[] }[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];

const tooltipStyle = {
  backgroundColor: 'rgba(13,13,18,0.95)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '10px',
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
};

const Visualization = () => {
  const API_URL = import.meta.env.VITE_API_URL || '';
  const { session_id } = useParams<{ session_id: string }>();
  const [segmentData, setSegmentData]   = useState<ChartData | null>(null);
  const [spendingData, setSpendingData] = useState<ChartData | null>(null);
  const [scatterData, setScatterData]   = useState<ScatterPoint[] | null>(null);
  const [seasonalData, setSeasonalData] = useState<SeasonalData | null>(null);
  const [isLoading, setIsLoading]       = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [segRes, spendRes, scatterRes, seasonalRes] = await Promise.all([
          fetch(`${API_URL}/api/segment-counts/${session_id}`),
          fetch(`${API_URL}/api/spending-by-segment/${session_id}`),
          fetch(`${API_URL}/api/recency-value-scatter/${session_id}`),
          fetch(`${API_URL}/api/seasonal-distribution/${session_id}`)
        ]);
        if (segRes.ok)      setSegmentData(await segRes.json());
        if (spendRes.ok)    setSpendingData(await spendRes.json());
        if (scatterRes.ok)  setScatterData(await scatterRes.json());
        if (seasonalRes.ok) setSeasonalData(await seasonalRes.json());
      } catch (err) {
        console.error('Fetch error', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [session_id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-blue-500 font-black text-xs">CUE-X</div>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const pieData = (segmentData?.labels ?? []).map((label, i) => ({
    name: label, value: segmentData!.values[i]
  }));

  const barData = (spendingData?.labels ?? []).map((label, i) => ({
    name: label, value: spendingData!.values[i]
  }));

  const seasonalChartData = (seasonalData?.labels ?? []).map((month, i) => {
    const entry: Record<string, string | number> = { name: month };
    seasonalData!.datasets.forEach(ds => { entry[ds.label] = ds.data[i]; });
    return entry;
  });

  const totalCustomers = pieData.reduce((a, b) => a + b.value, 0);
  const avgSpend = barData.length
    ? barData.reduce((a, b) => a + b.value, 0) / barData.length
    : 0;

  return (
    <div className="min-h-screen bg-[#050508] text-gray-100 font-sans p-6 md:p-12 selection:bg-blue-500/30">
      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/5 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between mb-16 gap-8">
        <div className="space-y-4">
          <Link to="/" className="inline-flex items-center gap-2 text-blue-400/60 hover:text-blue-400 transition-all text-sm font-bold tracking-widest uppercase group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            E-Engine Portal
          </Link>
          <div className="space-y-2">
            <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-none">
              Intelligence <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-500 to-indigo-600">Overview</span>
            </h1>
            <p className="text-gray-500 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Active Analysis Session: <span className="text-blue-400/80 font-mono">{session_id}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button className="glass-premium px-8 py-4 rounded-2xl flex items-center gap-3 hover:bg-white/5 transition-all font-black text-xs tracking-widest uppercase">
            <Download className="w-4 h-4 text-purple-400" /> Download PDF
          </button>
          <a href={`${API_URL}/download`} className="bg-blue-600 hover:bg-blue-500 px-8 py-4 rounded-2xl flex items-center gap-3 transition-all font-black text-xs tracking-widest uppercase shadow-[0_0_30px_rgba(37,99,235,0.3)] active:scale-95">
            <Download className="w-4 h-4" /> Export Schema
          </a>
        </div>
      </header>

      <main className="relative z-10 space-y-8">
        {/* Stats */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Analyzed Base',   value: totalCustomers.toLocaleString(),       icon: Users,      color: 'text-blue-400' },
            { label: 'Target Clusters', value: pieData.length,                        icon: Target,     color: 'text-purple-400' },
            { label: 'Average Value',   value: `$${Math.round(avgSpend).toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-400' },
            { label: 'X-Compute Speed', value: '142ms',                               icon: Zap,        color: 'text-yellow-400' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-card p-8 rounded-3xl flex items-center gap-6 group"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                <h3 className="text-3xl font-black">{stat.value}</h3>
              </div>
            </motion.div>
          ))}
        </section>

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left — 2 big charts */}
          <div className="lg:col-span-2 space-y-8">

            {/* Bar Chart */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass-premium rounded-[2.5rem] p-10 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                <BarChart3 className="w-32 h-32" />
              </div>
              <div className="mb-8 space-y-2 relative z-10">
                <h3 className="text-2xl font-black tracking-tight uppercase tracking-wider text-gray-400">Behavioral Matrix</h3>
                <h2 className="text-4xl font-black">Average Expenditure</h2>
              </div>
              {/* Use fixed width/height directly on chart component — no ResponsiveContainer */}
              <div className="overflow-x-auto">
                <BarChart
                  width={680} height={350}
                  data={barData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  style={{ maxWidth: '100%' }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#e5e7eb', fontWeight: 700 }} itemStyle={{ color: '#93c5fd' }} />
                  <Bar dataKey="value" name="Avg Spend ($)" radius={[12, 12, 4, 4]} maxBarSize={80}>
                    {barData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </div>
            </motion.div>

            {/* Scatter Chart */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass-premium rounded-[2.5rem] p-10 relative overflow-hidden"
            >
              <div className="mb-8 space-y-2 relative z-10">
                <h3 className="text-2xl font-black tracking-tight uppercase tracking-wider text-gray-400">Customer Lifecycle</h3>
                <h2 className="text-4xl font-black">Recency vs Order Value</h2>
              </div>
              <div className="overflow-x-auto">
                <ScatterChart
                  width={680} height={350}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" dataKey="x" name="Recency" unit="d" reversed axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }} />
                  <YAxis type="number" dataKey="y" name="Value" unit="$" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 700 }} />
                  <ZAxis type="number" range={[60, 400]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' }} contentStyle={tooltipStyle} labelStyle={{ color: '#e5e7eb', fontWeight: 700 }} itemStyle={{ color: '#93c5fd' }} />
                  <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ color: '#9ca3af', fontSize: 11 }} />
                  {(scatterData ?? []).map((segment, idx) => (
                    <Scatter
                      key={segment.name}
                      name={segment.name}
                      data={segment.data.map(p => ({ x: p[0], y: p[1], z: 10 }))}
                      fill={COLORS[idx % COLORS.length]}
                      fillOpacity={0.65}
                    />
                  ))}
                </ScatterChart>
              </div>
            </motion.div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-8">
            {/* Pie */}
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="glass-premium rounded-[2.5rem] p-8"
            >
              <div className="mb-6 space-y-1">
                <PieIcon className="w-6 h-6 text-blue-500 mb-4" />
                <h3 className="text-xl font-black">Segment Share</h3>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Market Breakdown</p>
              </div>
              <div className="flex justify-center">
                <PieChart width={260} height={220}>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={8} dataKey="value" strokeWidth={0}>
                    {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} fillOpacity={0.85} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#e5e7eb', fontWeight: 700 }} itemStyle={{ color: '#93c5fd' }} />
                </PieChart>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter truncate">{entry.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Area Chart */}
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="glass-premium rounded-[2.5rem] p-8"
            >
              <div className="mb-6 space-y-1">
                <Calendar className="w-6 h-6 text-purple-500 mb-4" />
                <h3 className="text-xl font-black">Seasonal Fluxing</h3>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Temporal Purchase Data</p>
              </div>
              <div className="overflow-x-auto flex justify-center">
                <AreaChart width={300} height={220} data={seasonalChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 9, fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 9 }} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#e5e7eb', fontWeight: 700 }} itemStyle={{ color: '#93c5fd' }} />
                  {(seasonalData?.datasets ?? []).map((dataset, i) => (
                    <Area key={dataset.label} type="monotone" dataKey={dataset.label}
                      stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.12} strokeWidth={2} />
                  ))}
                </AreaChart>
              </div>
            </motion.div>

            {/* AI Insights */}
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="glass-premium rounded-[2.5rem] p-8 bg-gradient-to-br from-blue-600/10 to-indigo-600/5 border-blue-500/10"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-6">
                <Zap className="w-6 h-6 text-blue-400" />
              </div>
              <h4 className="text-xl font-black mb-4 uppercase tracking-tight">Machine Recommendation</h4>
              <p className="text-sm text-gray-400 leading-relaxed font-medium">
                Analysis detects a high correlation between{' '}
                <span className="text-blue-400">Seasonal Buyers</span> and current Q4 trends.
                Deploying{' '}
                <span className="text-white font-bold underline decoration-blue-500/50 underline-offset-4">Omega-X Protocol</span>{' '}
                is advised.
              </p>
              <button className="w-full py-5 bg-white text-black font-black rounded-2xl hover:bg-blue-50 transition-all text-xs tracking-widest mt-8 uppercase shadow-xl">
                Execute Targeted Action
              </button>
            </motion.div>
          </div>
        </div>
      </main>

      <footer className="mt-16 py-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-gray-500 text-[10px] font-black tracking-widest uppercase">
        <div className="flex items-center gap-4">
          <Link to="/" className="hover:text-blue-400 transition-colors">Documentation</Link>
          <span className="w-1 h-1 rounded-full bg-gray-700" />
          <Link to="/" className="hover:text-blue-400 transition-colors">API Status</Link>
        </div>
        <div className="flex items-center gap-2">
          <MousePointer2 className="w-3 h-3" />
          <span>Interactive Neural Dashboard v4.2.0</span>
        </div>
      </footer>
    </div>
  );
};

export default Visualization;
