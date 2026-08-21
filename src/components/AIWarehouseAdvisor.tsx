import React, { useState } from 'react';
import { 
  Sparkles, 
  Bot, 
  Send, 
  AlertTriangle, 
  RefreshCw, 
  Lightbulb
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';

export const AIWarehouseAdvisor: React.FC = () => {
  const { items, analytics } = useInventory();
  const { currentUser } = useAuth();

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const quickPrompts = [
    {
      title: 'Prediksi Restock & SKU Kritis',
      prompt: 'Analisis stok inventaris saat ini dan berikan rekomendasi restock prioritas untuk item yang mendekati atau di bawah safety stock.',
    },
    {
      title: 'Optimasi Slotting Rak (Golden Zone)',
      prompt: 'Berdasarkan kelas ABC dan rotasi pergerakan barang, berikan saran pemindahan slotting rak agar operator dapat memetik barang lebih cepat.',
    },
    {
      title: 'Audit Risiko Barang Lambat (Slow Moving)',
      prompt: 'Identifikasi SKU yang tergolong slow moving (Kelas C) dan berikan saran optimasi kapasitas gudang agar stok tidak menumpuk.',
    },
  ];

  const handleAskAI = async (customText?: string) => {
    const query = customText || aiPrompt;
    if (!query.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          inventoryContext: {
            totalSkus: analytics.totalSkus,
            totalUnits: analytics.totalUnits,
            occupancyRate: analytics.occupancyRatePct,
            lowStockItems: items.filter((i) => i.status !== 'IN_STOCK').map((i) => ({
              sku: i.sku,
              name: i.name,
              stock: i.stock,
              minStock: i.minStock,
              location: i.location.fullCode,
              abcClass: i.abcClass,
            })),
            fastMovingCount: analytics.fastMovingCount,
            slowMovingCount: analytics.slowMovingCount,
          },
        }),
      });

      const data = await res.json();
      if (data.analysis) {
        setAiResponse(data.analysis);
      } else {
        setErrorMsg('Gagal menerima tanggapan dari AI Advisor.');
      }
    } catch (err) {
      setErrorMsg('Koneksi ke backend AI server bermasalah.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Top Banner */}
      <div className="p-5 rounded-xl bg-[#14161B] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold text-white">
                AI Warehouse Intelligence & Slotting Advisor
              </h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-600/10 text-indigo-400 border border-indigo-500/20">
                Gemini 2.5 Flash
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Analisis prediktif penempatan rak ergonomis, deteksi stok berisiko, dan optimasi operasional
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Model: <span className="text-indigo-400 font-medium">gemini-2.5-flash</span>
        </div>
      </div>

      {/* Quick Recommendation Prompts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {quickPrompts.map((qp, idx) => (
          <button
            key={idx}
            onClick={() => {
              setAiPrompt(qp.prompt);
              handleAskAI(qp.prompt);
            }}
            className="p-4 rounded-xl bg-[#14161B] border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 text-left transition-all group flex flex-col justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1 rounded bg-indigo-600/10 text-indigo-400">
                <Lightbulb className="w-3.5 h-3.5" />
              </div>
              <h4 className="text-xs font-semibold text-white group-hover:text-indigo-400">
                {qp.title}
              </h4>
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
              {qp.prompt}
            </p>
          </button>
        ))}
      </div>

      {/* Input Query Bar */}
      <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskAI();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Tanyakan analisis inventaris (cth: 'Bagaimana cara menata rak di Zona B agar picking lebih efisien?')..."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="flex-1 bg-[#0A0B0E] border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={isLoading || !aiPrompt.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm flex items-center gap-2 transition-all shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menganalisis...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Kirim Analisis
              </>
            )}
          </button>
        </form>
      </div>

      {/* Response Display Box */}
      {isLoading && (
        <div className="p-8 rounded-xl bg-[#14161B] border border-slate-800 flex flex-col items-center justify-center text-center space-y-2">
          <div className="w-10 h-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 animate-pulse">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">Gemini sedang menganalisis data inventaris gudang...</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Memproses korelasi data stok, rotasi ABC, dan okupansi rak</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {aiResponse && !isLoading && (
        <div className="p-5 rounded-xl bg-[#14161B] border border-slate-800 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-semibold text-white">Hasil Analisis & Rekomendasi AI</h3>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              Live Telemetry
            </span>
          </div>

          <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-sans">
            {aiResponse}
          </div>
        </div>
      )}

    </div>
  );
};
