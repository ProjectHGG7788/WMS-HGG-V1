import React, { useState } from 'react';
import { 
  Printer, 
  X, 
  Check, 
  Copy
} from 'lucide-react';
import { InventoryItem } from '../types';

interface BarcodeLabelGeneratorProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const BarcodeLabelGenerator: React.FC<BarcodeLabelGeneratorProps> = ({ item, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [printCopies, setPrintCopies] = useState(1);

  if (!isOpen || !item) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(item.barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div 
        className="bg-[#14161B] border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-[#0A0B0E]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Generator Label Barcode</h3>
              <p className="text-xs text-slate-400">Stiker Label Standar Rak & Inventaris Gudang</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Sticker Preview Card */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 flex flex-col items-center">
          
          <div className="text-xs text-slate-400 text-center font-medium">
            Pratinjau Format Cetak Thermal Label (100mm x 60mm):
          </div>

          {/* Physical Sticker Mockup */}
          <div 
            id="printable-barcode-sticker" 
            className="w-full max-w-sm bg-white text-slate-900 p-4 rounded-lg shadow-xl border border-slate-300 space-y-3 font-sans"
          >
            {/* Top Brand & Warehouse Header */}
            <div className="flex items-center justify-between border-b border-slate-900 pb-2">
              <div className="font-extrabold text-xs tracking-wider text-slate-900 uppercase">
                WMS GUDANG PINTAR
              </div>
              <div className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                LOT: {item.batchLot}
              </div>
            </div>

            {/* Product Title & Category */}
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                {item.category}
              </div>
              <div className="text-sm font-bold text-slate-950 leading-tight line-clamp-2">
                {item.name}
              </div>
            </div>

            {/* SKU and Location Coordinates */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-2 rounded border border-slate-200">
              <div>
                <div className="text-[9px] uppercase font-bold text-slate-500">Kode SKU:</div>
                <div className="font-mono text-xs font-black text-indigo-900">{item.sku}</div>
              </div>
              <div>
                <div className="text-[9px] uppercase font-bold text-slate-500">Lokasi Rak Bin:</div>
                <div className="font-mono text-xs font-black text-rose-700">{item.location.fullCode}</div>
              </div>
            </div>

            {/* SVG Visual Barcode Simulation */}
            <div className="pt-2 flex flex-col items-center justify-center">
              {/* Simulated Code-128 Barcode Bars */}
              <div className="w-full h-12 flex items-end justify-center gap-[2px] px-2 bg-white">
                {[
                  3,1,2,1,4,2,1,3,1,2,3,1,1,4,2,1,2,3,1,1,3,2,1,4,1,2,3,1,2,1,4,2,1,3,2,1,1,3,2,1,4,1,2,3,1,2
                ].map((thickness, idx) => (
                  <div
                    key={idx}
                    className="bg-black h-full"
                    style={{ width: `${thickness}px` }}
                  />
                ))}
              </div>
              <div className="font-mono text-xs font-bold tracking-widest text-slate-900 mt-1">
                {item.barcode}
              </div>
            </div>

            {/* Bottom info */}
            <div className="flex items-center justify-between text-[9px] text-slate-600 pt-1 border-t border-slate-200">
              <span>Pemasok: {item.supplier}</span>
              <span>Satuan: {item.unit}</span>
            </div>
          </div>

          {/* Quick Copy / Print Config */}
          <div className="w-full max-w-sm flex items-center justify-between gap-3 text-xs">
            <button
              onClick={handleCopyBarcode}
              className="flex-1 py-2 px-3 rounded-lg bg-[#0A0B0E] hover:bg-slate-800 border border-slate-800 text-slate-200 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'Tersalin!' : 'Salin Barcode'}</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Jumlah:</span>
              <input
                type="number"
                min="1"
                max="50"
                value={printCopies}
                onChange={(e) => setPrintCopies(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 bg-[#0A0B0E] border border-slate-800 rounded-lg px-2 py-1.5 text-center text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-[#0A0B0E] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#14161B] hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Tutup
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Cetak Label Barcode ({printCopies}x)
          </button>
        </div>

      </div>
    </div>
  );
};
