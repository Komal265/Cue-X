import { motion } from 'framer-motion';
import { ArrowRight, AlertTriangle, Lightbulb, CheckCircle2, Sparkles, RefreshCw } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrimaryCampaign {
  name: string;
  tagline: string;
  objective: string;
  channels: string[];
  offer: string;
  cta: string;
}

export interface Strategy {
  segment_label: string;
  segment_summary: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  rfm_insight: string;
  primary_campaign: PrimaryCampaign;
  copy_hooks: string[];
  kpis: string[];
  risk: string;
  next_best_action: string;
}

interface StrategyCardProps {
  idx: number;
  segmentId: number;
  segmentName: string;
  segmentValue: number;
  defaultCampaign: string;
  defaultStrategy: string;
  strategy?: Strategy;
  isLoading: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onGenerate: (e: React.MouseEvent) => void;
}

// ─── Urgency config ───────────────────────────────────────────────────────────

const URGENCY_CONFIG = {
  HIGH:   { color: 'border-red-500',     badge: 'bg-red-500/20 text-red-500 border-red-500',          dot: 'bg-red-400',     text: 'text-red-500' },
  MEDIUM: { color: 'border-amber-500',   badge: 'bg-amber-500/20 text-amber-500 border-amber-500',    dot: 'bg-amber-400',   text: 'text-amber-500' },
  LOW:    { color: 'border-emerald-500', badge: 'bg-emerald-500/20 text-emerald-500 border-emerald-500', dot: 'bg-emerald-400', text: 'text-emerald-500' },
  NONE:   { color: 'border-zinc-700',    badge: 'bg-zinc-800 text-zinc-400 border-zinc-700',          dot: 'bg-zinc-500',    text: 'text-zinc-500' },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const Skeleton = () => (
  <div className="flex flex-col items-center justify-center space-y-6 h-full py-12">
    <div className="w-10 h-10 border-2 border-neutral-800 border-t-white rounded-full animate-spin" />
    <div className="text-neutral-500 font-medium text-sm animate-pulse">Generating AI Strategy...</div>
    <div className="w-full max-w-md space-y-4 opacity-30">
      <div className="h-4 w-3/4 rounded bg-white/10" />
      <div className="h-4 w-1/2 rounded bg-white/10" />
      <div className="h-20 w-full rounded bg-white/10 mt-4" />
    </div>
  </div>
);

// ─── StrategyCard (Master List Item) ──────────────────────────────────────────

export const StrategyCard = ({ 
  idx, segmentId: _segmentId, segmentName, segmentValue, defaultCampaign, defaultStrategy: _defaultStrategy,
  strategy, isLoading, isExpanded, onToggle, onGenerate: _onGenerate
}: StrategyCardProps) => {

  const urgencyKey = strategy ? strategy.urgency : 'NONE';
  const theme = URGENCY_CONFIG[urgencyKey as keyof typeof URGENCY_CONFIG] || URGENCY_CONFIG.NONE;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.08 }}
      onClick={onToggle}
      className={`
        relative flex flex-col cursor-pointer transition-all duration-300 ease-out
        rounded-xl border
        border-l-[4px] ${theme.color}
        ${isExpanded 
          ? 'bg-white/5 border-t-white/10 border-r-white/10 border-b-white/10 shadow-lg shadow-white/5 scale-[1.02] z-10' 
          : 'bg-[#0D0D0D] border-t-transparent border-r-transparent border-b-transparent hover:bg-white/5 hover:border-r-white/5'}
      `}
    >
      <div className="p-5">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
            <h3 className="text-sm font-bold text-white">{segmentName}</h3>
          </div>
          {isLoading && <RefreshCw className="w-3 h-3 text-zinc-500 animate-spin" />}
        </div>
        <p className="text-xs text-zinc-500 truncate mb-4">
          {strategy ? strategy.primary_campaign.name : defaultCampaign}
        </p>
        <div className="flex justify-between items-center mt-auto">
          <span className="text-xs font-medium text-zinc-400">{segmentValue.toLocaleString()} <span className="text-zinc-600">users</span></span>
          {strategy ? (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${theme.text} border-${theme.color.split('-')[1]}-500/30 uppercase tracking-wider bg-${theme.color.split('-')[1]}-500/10`}>
              {strategy.urgency}
            </span>
          ) : (
            <span className="text-[10px] text-zinc-600 font-medium px-2 py-0.5 rounded bg-white/5 border border-white/5">
              NO AI
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ─── StrategyDetail (Detail View Pane) ────────────────────────────────────────

interface StrategyDetailProps {
  segmentName: string;
  strategy?: Strategy;
  isLoading: boolean;
  onGenerate: () => void;
}

export const StrategyDetail = ({
  segmentName, strategy, isLoading, onGenerate
}: StrategyDetailProps) => {

  if (isLoading) {
    return (
      <div className="glass-card rounded-[2rem] p-8 h-full min-h-[500px] flex items-center justify-center">
        <Skeleton />
      </div>
    );
  }

  if (!strategy) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }} 
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-[2rem] p-8 h-full min-h-[500px] flex flex-col items-center justify-center text-center relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-50" />
        <div className="relative z-10 flex flex-col items-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-xl">
            <Sparkles className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">AI Playbook</h3>
          <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
            Generate a highly specific, AI-driven marketing playbook tailored to the unique behavioral patterns of the <span className="text-white font-medium">{segmentName}</span> segment.
          </p>
          <button 
            onClick={onGenerate}
            className="group flex items-center gap-2 px-8 py-3.5 bg-white text-black rounded-full text-sm font-bold hover:bg-zinc-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.4)]"
          >
            <Sparkles className="w-4 h-4 text-zinc-700 group-hover:text-black" /> Generate Strategy
          </button>
        </div>
      </motion.div>
    );
  }

  const urgencyKey = strategy.urgency || 'NONE';
  const theme = URGENCY_CONFIG[urgencyKey as keyof typeof URGENCY_CONFIG] || URGENCY_CONFIG.NONE;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      key={strategy.segment_label}
      className="glass-card rounded-[2rem] p-8 lg:p-10 h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-8 pb-8 border-b border-white/5 gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <h2 className="text-3xl font-bold text-white tracking-tight">{segmentName}</h2>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${theme.text} ${theme.badge} uppercase tracking-widest`}>
              {urgencyKey} Priority
            </span>
          </div>
          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">{strategy.segment_summary}</p>
        </div>
        <button 
          onClick={onGenerate} 
          className="flex-shrink-0 flex items-center justify-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/5 w-full md:w-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Regenerate
        </button>
      </div>

      {/* Content Grid */}
      <div className="space-y-8 flex-1">
        
        {/* Insight & Action */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-blue-400" />
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest">RFM Insight</p>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed flex-1">{strategy.rfm_insight}</p>
          </div>
          
          <div className={`p-5 rounded-2xl bg-opacity-5 border border-opacity-20 flex flex-col ${theme.badge.split(' ')[0]} ${theme.color}`}>
            <div className="flex items-center gap-2 mb-3">
              <ArrowRight className={`w-4 h-4 ${theme.text}`} />
              <p className={`text-xs font-semibold uppercase tracking-widest ${theme.text}`}>Next Best Action</p>
            </div>
            <p className="text-sm text-white font-medium leading-relaxed flex-1">{strategy.next_best_action}</p>
          </div>
        </div>

        {/* Campaign Block */}
        <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Primary Campaign</p>
          <div className="mb-6">
            <h4 className="text-2xl font-bold text-white mb-2">{strategy.primary_campaign.name}</h4>
            <p className="text-sm text-zinc-400 italic">"{strategy.primary_campaign.tagline}"</p>
          </div>
          
          <p className="text-sm text-zinc-300 mb-6 leading-relaxed">{strategy.primary_campaign.objective}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Channels</p>
              <div className="flex flex-wrap gap-2">
                {strategy.primary_campaign.channels.map(ch => (
                  <span key={ch} className="text-xs px-3 py-1.5 rounded-lg bg-black/40 border border-white/5 text-zinc-300">
                    {ch}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-3">Core Offer</p>
              <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <p className="text-sm text-emerald-100 font-medium">{strategy.primary_campaign.offer}</p>
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-white/5 flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Call To Action</p>
            <div className="px-6 py-2.5 bg-white/10 border border-white/20 text-white rounded-full text-sm font-medium">
              {strategy.primary_campaign.cta}
            </div>
          </div>
        </div>

        {/* Hooks, KPIs, Risk */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Copy Hooks</p>
            <div className="space-y-3">
              {strategy.copy_hooks.map((hook, i) => (
                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-white/20 group-hover:bg-white/40 transition-colors" />
                  <p className="text-sm text-zinc-300 italic pl-2">"{hook}"</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Success KPIs</p>
            <div className="p-5 rounded-xl bg-white/5 border border-white/5 space-y-4 h-full">
              {strategy.kpis.map((kpi, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-zinc-300 leading-snug">{kpi}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">Risk Factor</p>
            <div className="p-5 rounded-xl bg-amber-500/5 border border-amber-500/10 h-full flex flex-col gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <p className="text-sm text-zinc-400 leading-relaxed">{strategy.risk}</p>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
};

