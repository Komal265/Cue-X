import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ScatterChart, Scatter, ZAxis, AreaChart, Area, Legend
} from 'recharts';
import {
  ArrowLeft, Download, TrendingUp, Zap,
  Users, Target
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AntiGravityCanvas } from '../components/ui/particle-effect-for-hero';

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

const COLORS = ['#FFFFFF', '#A3A3A3', '#525252', '#3B82F6', '#10B981'];

const tooltipStyle = {
  backgroundColor: '#0A0A0A',
  border: '1px solid #262626',
  borderRadius: '8px',
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
};

const Visualization = () => {
  const API_URL = import.meta.env.VITE_API_URL;
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
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="relative flex flex-col items-center gap-4">
          <div className="w-6 h-6 border-2 border-neutral-800 border-t-white rounded-full animate-spin" />
          <div className="text-neutral-500 font-medium text-sm">Processing Data Model</div>
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
    <div className="relative min-h-screen bg-black text-neutral-200 font-sans selection:bg-white/20">
      <AntiGravityCanvas />
      
      <div className="relative z-10 p-6 md:p-12">
      {/* Header */}
      <header className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between mb-16 gap-8">
        <div className="space-y-6">
          <Link to="/" className="inline-flex items-center gap-2 text-neutral-500 hover:text-neutral-300 transition-all text-sm font-medium group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-white">
              Customer Analytics
            </h1>
            <p className="text-neutral-500 font-medium flex items-center gap-2 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Session ID: <span className="font-mono text-neutral-400">{session_id}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="px-5 py-2.5 rounded-lg border border-neutral-800 bg-[#111] hover:bg-[#1A1A1A] transition-all font-medium text-sm text-neutral-300 flex items-center gap-2">
            <Download className="w-4 h-4" /> Download Report
          </button>
          <a href={`${API_URL}/download`} className="px-5 py-2.5 rounded-lg bg-white text-black hover:bg-neutral-200 transition-all font-medium text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </a>
        </div>
      </header>

      <main className="relative z-10 space-y-6">
        {/* Stats */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Analyzed Base',   value: totalCustomers.toLocaleString(),       icon: Users },
            { label: 'Target Clusters', value: pieData.length,                        icon: Target },
            { label: 'Average Value',   value: `$${Math.round(avgSpend).toLocaleString()}`, icon: TrendingUp },
            { label: 'Analysis Time',   value: '1.2s',                               icon: Zap },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass-card p-6 rounded-2xl flex flex-col gap-3 group"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-neutral-500">{stat.label}</p>
                <stat.icon className="w-4 h-4 text-neutral-600" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-white">{stat.value}</h3>
              </div>
            </motion.div>
          ))}
        </section>

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left — 2 big charts */}
          <div className="lg:col-span-2 space-y-6">

            {/* Bar Chart */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass-card rounded-[2rem] p-8"
            >
              <div className="mb-8 space-y-1">
                <h3 className="text-sm font-medium text-neutral-500">Expenditure</h3>
                <h2 className="text-xl font-semibold tracking-tight text-white">Average Order Value by Segment</h2>
              </div>
              <div className="overflow-x-auto">
                <BarChart
                  width={680} height={320}
                  data={barData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                  style={{ maxWidth: '100%' }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 12, fontWeight: 500 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 12, fontWeight: 500 }} tickFormatter={(v) => `$${v}`} dx={-10} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={tooltipStyle} labelStyle={{ color: '#FAFAFA', fontWeight: 600, marginBottom: '4px' }} itemStyle={{ color: '#A3A3A3', fontSize: '13px' }} formatter={(val) => [`$${val}`, 'Value']} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {barData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </div>
            </motion.div>

            {/* Scatter Chart */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="glass-card rounded-[2rem] p-8"
            >
              <div className="mb-8 space-y-1">
                <h3 className="text-sm font-medium text-neutral-500">Lifecycle Focus</h3>
                <h2 className="text-xl font-semibold tracking-tight text-white">Recency vs Monetary Value</h2>
              </div>
              <div className="overflow-x-auto">
                <ScatterChart
                  width={680} height={320}
                  margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                  <XAxis type="number" dataKey="x" name="Recency" unit="d" reversed axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 12, fontWeight: 500 }} dy={10} />
                  <YAxis type="number" dataKey="y" name="Value" unit="$" axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 12, fontWeight: 500 }} dx={-10} />
                  <ZAxis type="number" range={[40, 200]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3', stroke: '#404040' }} contentStyle={tooltipStyle} labelStyle={{ color: '#FAFAFA' }} itemStyle={{ color: '#A3A3A3', fontSize: '13px' }} />
                  <Legend verticalAlign="top" iconType="circle" wrapperStyle={{ color: '#737373', fontSize: 13, paddingBottom: '20px' }} />
                  {(scatterData ?? []).map((segment, idx) => (
                    <Scatter
                      key={segment.name}
                      name={segment.name}
                      data={segment.data.map(p => ({ x: p[0], y: p[1], z: 1 }))}
                      fill={COLORS[idx % COLORS.length]}
                      fillOpacity={0.8}
                    />
                  ))}
                </ScatterChart>
              </div>
            </motion.div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Pie */}
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="glass-card rounded-[2rem] p-8"
            >
              <div className="mb-6 space-y-1">
                <h3 className="text-lg font-semibold tracking-tight text-white">Distribution</h3>
                <p className="text-neutral-500 text-sm font-medium">Customer base composition</p>
              </div>
              <div className="flex justify-center my-8">
                <PieChart width={220} height={220}>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={90} paddingAngle={2} dataKey="value" strokeWidth={0}>
                    {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#A3A3A3', fontSize: '13px' }} />
                </PieChart>
              </div>
              <div className="space-y-3 mt-4">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm font-medium text-neutral-300">{entry.name}</span>
                    </div>
                    <span className="text-sm font-medium text-neutral-500">{entry.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Area Chart */}
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="glass-card rounded-[2rem] p-8"
            >
              <div className="mb-6 space-y-1">
                <h3 className="text-lg font-semibold tracking-tight text-white">Trends</h3>
                <p className="text-neutral-500 text-sm font-medium">Seasonal variances</p>
              </div>
              <div className="overflow-x-auto flex justify-center -mx-4">
                <AreaChart width={280} height={180} data={seasonalChartData}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 11 }} dy={10} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#FAFAFA' }} itemStyle={{ fontSize: '12px' }} />
                  {(seasonalData?.datasets ?? []).map((dataset, i) => (
                    <Area key={dataset.label} type="monotone" dataKey={dataset.label}
                      stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.05} strokeWidth={2} />
                  ))}
                </AreaChart>
              </div>
            </motion.div>

            {/* AI Insights */}
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="glass-card rounded-[2rem] p-8 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-16 -mt-16" />
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-blue-500" />
                <h4 className="text-sm font-semibold text-neutral-300">Action Plan</h4>
              </div>
              <p className="text-sm text-neutral-400 leading-relaxed font-medium">
                Analysis detects strong retention opportunities in <span className="text-white">Q4 Trends</span>.
                Deploy automated outreach.
              </p>
              <button className="w-full py-2.5 mt-6 border border-neutral-800 bg-[#111] hover:bg-[#1A1A1A] text-white font-medium rounded-lg transition-all text-sm">
                Apply System Recommendation
              </button>
            </motion.div>
          </div>
        </div>

        {/* Actionable Strategies Section */}
        <section className="relative z-10 space-y-6 pt-12 pb-8">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-neutral-500">Next Steps</h3>
            <h2 className="text-xl font-semibold tracking-tight text-white">Segment Strategy Playbooks</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pieData.map((segment, idx) => {
              let strategy = "Maintain regular engagement with personalized content and standard promotional offers.";
              const name = segment.name.toLowerCase();
              if (name.includes('high') || name.includes('vip') || name.includes('champion') || name.includes('rich') || name.includes('whale') || name.includes('power')) {
                strategy = "Provide VIP perks, early access to new collections, and dedicated account management to retain high value.";
              } else if (name.includes('low') || name.includes('risk') || name.includes('churn') || name.includes('lost') || name.includes('dormant') || name.includes('inactive')) {
                strategy = "Deploy aggressive win-back campaigns, high-value discount codes, and surveys to understand dissatisfaction.";
              } else if (name.includes('new') || name.includes('promising') || name.includes('recent') || name.includes('potential')) {
                strategy = "Trigger welcome automation sequence, offer first-time buyer discounts, and highlight popular products.";
              } else if (name.includes('loyal') || name.includes('frequent') || name.includes('regular') || name.includes('core')) {
                strategy = "Upsell complementary products, offer referral bonuses, and ask for product reviews.";
              }
              
              return (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
                  className="glass-card p-6 rounded-2xl flex flex-col justify-between group"
                >
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                       {segment.name}
                    </h3>
                    <p className="text-sm text-neutral-400 leading-relaxed font-medium mb-6">
                      {strategy}
                    </p>
                  </div>
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-neutral-500">
                       {parseInt(segment.value.toString()).toLocaleString()} Users
                    </span>
                    <button className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1">
                      Execute Action &rarr;
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="mt-12 py-8 border-t border-neutral-900 flex justify-between items-center text-neutral-500 font-medium text-xs">
        <div className="flex items-center gap-4">
          <Link to="/" className="hover:text-neutral-300 transition-colors">Docs</Link>
          <Link to="/" className="hover:text-neutral-300 transition-colors">API</Link>
        </div>
        <div>
          <span>CUE-X Analytics Dashboard</span>
        </div>
      </footer>
      </div>
    </div>
  );
};

export default Visualization;
