import React, { useState } from 'react';
import { 
  Printer, 
  X, 
  Check, 
  Copy, 
  MapPin, 
  Building2, 
  Boxes, 
  Layers, 
  Hash, 
  QrCode
} from 'lucide-react';
import { WarehouseLocator } from '../types';

interface LocatorBarcodeModalProps {
  locator: WarehouseLocator | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LocatorBarcodeModal: React.FC<LocatorBarcodeModalProps> = ({ locator, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [labelFormat, setLabelFormat] = useState<'barcode' | 'qr'>('barcode');

  if (!isOpen || !locator) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(locator.fullCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div 
        className="bg-[#14161B] border border-slate-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-[#0A0B0E]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Label Stiker Locator</h3>
              <p className="text-xs text-slate-400">Stiker Label Identifikasi Fisik Rak / Palet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 flex flex-col items-center">
          
          <div className="flex items-center justify-between w-full text-xs text-slate-400">
            <span>Pilih Gaya Tampilan:</span>
            <div className="flex items-center gap-1 bg-[#0A0B0E] p-1 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setLabelFormat('barcode')}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                  labelFormat === 'barcode' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Barcode 1D
              </button>
              <button
                type="button"
                onClick={() => setLabelFormat('qr')}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors ${
                  labelFormat === 'qr' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                QR Code 2D
              </button>
            </div>
          </div>

          {/* Physical Printable Label Sticker */}
          <div 
            id="printable-locator-label" 
            className="w-full bg-white text-slate-900 p-5 rounded-lg shadow-2xl border border-slate-300 space-y-3.5 font-sans"
          >
            {/* Top Warehouse Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
              <div>
                <div className="font-black text-sm tracking-wider text-slate-900 uppercase">
                  {locator.warehouseName || `GUDANG ${locator.warehouseCode}`}
                </div>
                <div className="text-[10px] text-slate-600 font-mono">
                  LOCATOR POSITION TAG
                </div>
              </div>
              <div className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-1 rounded uppercase">
                {locator.storageType}
              </div>
            </div>

            {/* Huge Full Locator Code */}
            <div className="text-center bg-slate-100 p-2.5 rounded border border-slate-300">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                KODE POSISI LENGKAP
              </div>
              <div className="text-xl font-black font-mono tracking-wider text-indigo-950 mt-0.5">
                {locator.fullCode}
              </div>
            </div>

            {/* 5 Components Grid */}
            <div className="grid grid-cols-5 gap-1 text-center font-mono">
              <div className="p-1 rounded bg-slate-50 border border-slate-200">
                <span className="text-[8px] text-slate-400 block font-bold">1. GUDANG</span>
                <span className="text-[11px] font-black text-slate-900">{locator.warehouseCode}</span>
              </div>
              <div className="p-1 rounded bg-slate-50 border border-slate-200">
                <span className="text-[8px] text-slate-400 block font-bold">2. RAK/FLR</span>
                <span className="text-[11px] font-black text-slate-900">{locator.rackOrFloorCode}</span>
              </div>
              <div className="p-1 rounded bg-slate-50 border border-slate-200">
                <span className="text-[8px] text-slate-400 block font-bold">3. LORONG</span>
                <span className="text-[11px] font-black text-slate-900">{locator.aisle || '-'}</span>
              </div>
              <div className="p-1 rounded bg-slate-50 border border-slate-200">
                <span className="text-[8px] text-slate-400 block font-bold">4. LEVEL</span>
                <span className="text-[11px] font-black text-slate-900">{locator.level || '-'}</span>
              </div>
              <div className="p-1 rounded bg-slate-50 border border-slate-200">
                <span className="text-[8px] text-slate-400 block font-bold">5. PALET</span>
                <span className="text-[11px] font-black text-slate-900">{locator.pallet || '-'}</span>
              </div>
            </div>

            {/* Barcode / QR Visual Representation */}
            <div className="py-2 flex flex-col items-center justify-center bg-slate-50 rounded border border-slate-200">
              {labelFormat === 'barcode' ? (
                <div className="space-y-1.5 flex flex-col items-center">
                  <div className="flex items-center gap-[2.5px] h-12 px-3">
                    {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4].map((width, idx) => (
                      <div 
                        key={idx} 
                        className="h-full bg-slate-950" 
                        style={{ width: `${width * 1.5}px` }}
                      />
                    ))}
                  </div>
                  <div className="text-xs font-mono font-bold tracking-widest text-slate-800">
                    *{locator.fullCode}*
                  </div>
                </div>
              ) : (
                <div className="p-2 bg-white rounded border border-slate-300 flex flex-col items-center space-y-1">
                  <QrCode className="w-20 h-20 text-slate-950" />
                  <div className="text-[10px] font-mono font-bold text-slate-800">
                    SCAN FOR POSITION
                  </div>
                </div>
              )}
            </div>

            {/* Footer Attributes */}
            <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono border-t border-slate-200 pt-2">
              <div>KAPASITAS: {locator.maxCapacityUnits} UNIT</div>
              <div>SUHU: {locator.temperatureType}</div>
            </div>

          </div>

          <div className="flex items-center gap-2 w-full pt-2">
            <button
              onClick={handleCopyCode}
              className="flex-1 py-2 rounded-lg bg-[#0A0B0E] hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin Kode Locator</span>
                </>
              )}
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Label (Print)</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
