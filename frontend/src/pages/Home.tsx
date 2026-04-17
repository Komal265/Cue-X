import { useState } from 'react';
import { HorizonHeroSection } from '../components/ui/horizon-hero-section';
import { Upload, ArrowRight, BarChart3, Zap, Users, ShieldCheck, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';

const Home = () => {
  const API_URL = import.meta.env.VITE_API_URL;
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setIsLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
      const data = await response.json();
      if (response.ok) {
        window.location.href = `/visualization/${data.session_id}`;
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="text-white selection:bg-white/20 min-h-screen relative">

      {/* ── 3D Horizon Landing (scrollable) ── */}
      <HorizonHeroSection />

      {/* ── Upload & Features Section ── */}
      <section className="relative z-20 py-24 px-6 md:px-12 border-t border-neutral-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">

            {/* Left — description + feature cards */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-800 bg-[#111] text-neutral-400 text-sm font-medium">
                <Zap className="w-4 h-4" />
                <span>Precision Analytics Engine</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight text-white">
                Understand Your <br />
                <span className="text-neutral-400">
                  Customers
                </span> Deeply
              </h2>

              <p className="text-lg text-neutral-500 font-medium leading-relaxed max-w-lg">
                Leverage CUE-X to segment your user base into actionable cohorts.
                Identify lifecycle patterns to drive highly targeted business
                strategies with precision.
              </p>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Users, label: 'Automated Cohorts', desc: 'Identify key customer groups instantly' },
                  { icon: BarChart3, label: 'Deep Insights', desc: 'Visualize purchase patterns and vectors' },
                ].map((feature, i) => (
                  <div key={i} className="glass-card p-6 rounded-2xl flex flex-col gap-3">
                    <feature.icon className="w-5 h-5 text-neutral-400" />
                    <div>
                      <h3 className="font-semibold text-white text-sm mb-1">{feature.label}</h3>
                      <p className="text-sm text-neutral-500 leading-relaxed font-medium">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Download Sample CSV ── */}
              <a
                href="/sample-data.csv"
                download="sample-data.csv"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-neutral-200 transition-all active:scale-[0.98]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Sample CSV
              </a>
            </motion.div>

            {/* Right — upload form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-card p-8 md:p-10 rounded-[2rem] border-neutral-800 relative overflow-hidden"
            >
              <div className="relative z-10 space-y-8 text-center">
                <div className="space-y-1">
                  <h3 className="text-2xl font-semibold tracking-tight text-white">Start Analysis</h3>
                  <p className="text-sm font-medium text-neutral-500">Upload your customer dataset (CSV) to begin</p>
                </div>

                <form onSubmit={handleUpload} className="space-y-6">
                  <label className="block">
                    <div className="border border-dashed border-neutral-700 hover:border-neutral-500 transition-colors p-8 rounded-xl flex flex-col items-center gap-4 cursor-pointer hover:bg-white/5 group bg-white/5">
                      <div className="w-12 h-12 rounded-lg bg-neutral-900/50 border border-neutral-800 flex items-center justify-center backdrop-blur-md">
                        <Upload className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-white">{file ? file.name : 'Select CSV File'}</p>
                        <p className="text-sm text-neutral-500 mt-1 font-medium">Drag and drop or click to browse</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept=".csv"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                      />
                    </div>
                  </label>

                  {error && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium">
                      {error}
                    </div>
                  )}

                  <button
                    disabled={!file || isLoading}
                    className="w-full h-14 bg-white hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed text-black font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-sm"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-neutral-400 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        Analyze Workspace
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <div className="pt-6 border-t border-neutral-900 flex items-center justify-center gap-6 text-[11px] text-neutral-500 font-medium">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>End-to-End Encrypted</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>X-Engine Core Processing</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <footer className="relative z-20 py-12 border-t border-neutral-800/50 text-center text-neutral-500 text-xs font-medium">
        <p>© 2024 CUE-X Analytics Engine. High-Performance Enterprise Segmentation.</p>
      </footer>
    </div>
  );
};

export default Home;
