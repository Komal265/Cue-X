import { useState, useRef, useEffect } from 'react';
import { Send, Zap, MessageSquare, Loader2, Bot, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWithAuth } from '../utils/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  powered_by?: string;
  data?: unknown;
}

interface DataChatProps {
  datasetId: string | undefined;
  apiUrl: string;
}

const EXAMPLE_QUESTIONS = [
  'How many customers are in each segment?',
  'What\'s the average spend for Champions?',
  'Which segment has the highest churn risk?',
  'Show me customers who haven\'t purchased in 90+ days',
  'What is the average recency per segment?',
];

const tooltipStyle = {
  backgroundColor: '#0A0A0A',
  border: '1px solid #262626',
  borderRadius: '8px',
};

export const DataChat: React.FC<DataChatProps> = ({ datasetId }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your AI data analyst. Ask me anything about your customer segments — spending patterns, churn risk, recency, or anything else in your dataset.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetchWithAuth(`/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataset_id: datasetId,
          question: question,
        }),
      });
      const data = await res.json();
      const aiMsg: Message = {
        role: 'assistant',
        content: data.answer || data.error || 'No response received.',
        powered_by: data.powered_by,
        data: data.data,
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Connection error. Please check that the backend is running.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="glass-card rounded-[2rem] flex flex-col h-[640px]" style={tooltipStyle}>
      {/* Header */}
      <div className="flex items-center gap-3 p-6 border-b border-white/5">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Ask Your Data</h3>
          <p className="text-xs text-neutral-500">Powered by Gemini AI</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-neutral-500">Live</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${
                  msg.role === 'user'
                    ? 'bg-white/10'
                    : 'bg-blue-500/20'
                }`}
              >
                {msg.role === 'user'
                  ? <User className="w-3.5 h-3.5 text-neutral-300" />
                  : <Bot className="w-3.5 h-3.5 text-blue-400" />
                }
              </div>

              {/* Bubble */}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-white/8 text-neutral-200 rounded-tr-sm'
                    : 'bg-white/4 text-neutral-300 rounded-tl-sm border border-white/5'
                }`}
                style={msg.role === 'user' ? { background: 'rgba(255,255,255,0.08)' } : { background: 'rgba(255,255,255,0.04)' }}
              >
                {msg.content.split('\n').map((line, li) => (
                  <span key={li}>
                    {line}
                    {li < msg.content.split('\n').length - 1 && <br />}
                  </span>
                ))}
                {msg.powered_by === 'gemini' && (
                  <div className="mt-1.5 flex items-center gap-1">
                    <Zap className="w-2.5 h-2.5 text-blue-500" />
                    <span className="text-[10px] text-blue-500/70">Gemini</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3 items-center"
          >
            <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="bg-white/4 border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 text-neutral-500 animate-spin" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Example chips */}
      <div className="px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-2 chat-scroll">
          {EXAMPLE_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => sendMessage(q)}
              disabled={isLoading}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-white/10 text-neutral-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 pt-0">
        <div className="flex gap-2 items-center border border-white/10 rounded-xl px-4 py-2.5 bg-white/3 focus-within:border-white/20 transition-all" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask anything about your customers…"
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-white placeholder-neutral-600 outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all disabled:opacity-30"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </form>
    </div>
  );
};
