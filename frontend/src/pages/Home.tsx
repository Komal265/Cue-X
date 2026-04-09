import { useState } from 'react';
import { HorizonHeroSection } from '../components/ui/horizon-hero-section';
import { Upload, ArrowRight, BarChart3, Zap, Users, ShieldCheck, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';

const Home = () => {
  const API_URL = import.meta.env.VITE_API_URL || '';
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
    <div className="bg-[#050508] text-white selection:bg-blue-500/30 min-h-screen">

      {/* ── 3D Horizon Landing (scrollable) ── */}
      <HorizonHeroSection />

      {/* ── Upload & Features Section ── */}
      <section className="relative z-20 py-24 px-6 md:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">

            {/* Left — description + feature cards */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium">
                <Zap className="w-4 h-4" />
                <span>Next-Gen Analytics Engine</span>
              </div>

              <h2 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
                Understand Your <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">
                  Customers
                </span>{' '}
                Deeply
              </h2>

              <p className="text-xl text-gray-400 font-light leading-relaxed">
                Leverage the power of CUE-X to segment your user base into actionable groups.
                Identify patterns that drive personalized recommendations and targeted business
                strategies with mathematical precision.
              </p>

              <div className="grid grid-cols-2 gap-6">
                {[
                  { icon: Users, label: 'Automated Segmentation', desc: 'Identify key customer groups instantly' },
                  { icon: BarChart3, label: 'Advanced Insights', desc: 'Visualize purchase patterns and trends' },
                ].map((feature, i) => (
                  <div key={i} className="glass-card p-6 rounded-2xl space-y-3">
                    <feature.icon className="w-8 h-8 text-blue-400" />
                    <h3 className="font-bold">{feature.label}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right — upload form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="glass p-1 rounded-[2.5rem] border-white/5 shadow-2xl relative overflow-hidden group"
            >
              <div className="bg-[#0a0a0f] p-10 rounded-[2.4rem] space-y-8 relative z-10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] -mr-32 -mt-32 rounded-full" />

                <div className="relative z-10 space-y-8 text-center">
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black tracking-tight">Start Analysis</h3>
                    <p className="text-gray-400">Upload your customer data (CSV) to begin</p>
                  </div>

                  <form onSubmit={handleUpload} className="space-y-6">
                    <label className="block">
                      <div className="border-2 border-dashed border-white/10 hover:border-blue-500/40 transition-colors p-10 rounded-3xl flex flex-col items-center gap-4 cursor-pointer hover:bg-white/5 group">
                        <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Upload className="w-10 h-10 text-blue-400" />
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold">{file ? file.name : 'Select CSV File'}</p>
                          <p className="text-sm text-gray-500 mt-1">Drag and drop or click to browse</p>
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
                      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {error}
                      </div>
                    )}

                    <button
                      disabled={!file || isLoading}
                      className="w-full h-16 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] shadow-lg shadow-blue-600/30 text-lg"
                    >
                      {isLoading ? (
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          Analyze Now
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="pt-8 border-t border-white/5 flex items-center justify-center gap-8 text-[10px] text-gray-500 font-black tracking-[0.2em] uppercase">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      <span>Encrypted</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-blue-500" />
                      <span>X-Engine Core</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <footer className="py-12 px-6 border-t border-white/5 text-center text-gray-500 text-sm font-medium">
        <p>© 2024 CUE-X Analytics Engine. High-Performance Customer Segmentation.</p>
      </footer>
    </div>
  );
};

export default Home;
