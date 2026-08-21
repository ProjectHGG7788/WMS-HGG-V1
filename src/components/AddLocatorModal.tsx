import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  X, 
  MapPin, 
  Building2, 
  Boxes, 
  Layers, 
  Hash, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  Warehouse
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { WarehouseLocator } from '../types';
import { generateLocatorFullCode } from '../utils/formatters';

interface AddLocatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (locator: WarehouseLocator) => void;
}

export const AddLocatorModal: React.FC<AddLocatorModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { saveLocator, locators, zones } = useInventory();

  // 5 Format Fields
  const [warehouseCode, setWarehouseCode] = useState('GDG-01');
  const [warehouseName, setWarehouseName] = useState('Gudang Pusat Cikarang');
  const [rackOrFloorCode, setRackOrFloorCode] = useState('');
  const [aisle, setAisle] = useState('');
  const [level, setLevel] = useState('');
  const [pallet, setPallet] = useState('');

  // Additional Locator Properties
  const [storageType, setStorageType] = useState<'RACK' | 'FLOOR' | 'PALLET_BULK' | 'STAGING'>('RACK');
  const [maxCapacityUnits, setMaxCapacityUnits] = useState(300);
  const [temperatureType, setTemperatureType] = useState<'AMBIENT' | 'AIR_CONDITIONED' | 'COLD_STORAGE' | 'HAZARDOUS'>('AMBIENT');
  const [notes, setNotes] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Live generated full code
  const generatedCode = generateLocatorFullCode({
    warehouseCode,
    rackOrFloorCode,
    aisle,
    level,
    pallet,
  });

  // Check if code already exists
  const isDuplicate = locators.some((l) => l.fullCode.toUpperCase() === generatedCode.toUpperCase() && generatedCode.length > 2);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setIsSubmitting(false);
      setRackOrFloorCode('');
      setAisle('');
      setLevel('');
      setPallet('');
      setNotes('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate 1. Kode Gudang (Mandatory) & 2. Kode Rak/Floor (Mandatory)
    if (!warehouseCode.trim()) {
      setErrorMsg('1. Kode Gudang (Mandatory) wajib diisi.');
      return;
    }
    if (!rackOrFloorCode.trim()) {
      setErrorMsg('2. Kode Rak/Floor (Mandatory) wajib diisi.');
      return;
    }

    if (isDuplicate) {
      setErrorMsg(`Kode locator "${generatedCode}" sudah terdaftar di sistem. Gunakan kode atau nomor palet/tingkat lain.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveLocator({
        warehouseCode: warehouseCode.trim().toUpperCase(),
        warehouseName: warehouseName.trim(),
        rackOrFloorCode: rackOrFloorCode.trim().toUpperCase(),
        aisle: aisle.trim().toUpperCase(),
        level: level.trim().toUpperCase(),
        pallet: pallet.trim().toUpperCase(),
        fullCode: generatedCode,
        storageType,
        maxCapacityUnits: Number(maxCapacityUnits) || 300,
        temperatureType,
        notes: notes.trim(),
      });

      if (res.success && res.locator) {
        setSuccessMsg(res.message);
        if (onSuccess) onSuccess(res.locator);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMsg(res.message || 'Gagal menyimpan locator baru.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div 
        className="bg-[#14161B] border border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-[#0A0B0E]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">Tambah Locator Baru</h3>
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-mono font-bold border border-indigo-500/20">
                  WMS Position Standard
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Daftarkan posisi rak fisik, area floor staging, atau slot palet baru ke sistem
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-140px)]">
          
          {/* Format Specification Banner */}
          <div className="p-3.5 rounded-lg bg-[#0A0B0E] border border-indigo-950/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                Format Penambahan Locator:
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                1 & 2 Wajib (Mandatory)
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5 text-center text-[11px] font-mono">
              <div className="p-1.5 rounded bg-indigo-950/50 border border-indigo-500/30 text-indigo-200">
                <span className="text-[9px] text-rose-400 block font-bold">1. Wajib *</span>
                <span>Kode Gudang</span>
              </div>
              <div className="p-1.5 rounded bg-indigo-950/50 border border-indigo-500/30 text-indigo-200">
                <span className="text-[9px] text-rose-400 block font-bold">2. Wajib *</span>
                <span>Kode Rak/Floor</span>
              </div>
              <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                <span className="text-[9px] text-slate-500 block">3. Opsional</span>
                <span>Lorong</span>
              </div>
              <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                <span className="text-[9px] text-slate-500 block">4. Opsional</span>
                <span>Level</span>
              </div>
              <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                <span className="text-[9px] text-slate-500 block">5. Opsional</span>
                <span>Palet</span>
              </div>
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 5 Standard Inputs */}
          <div className="space-y-4">
            
            {/* Row 1: 1. Kode Gudang & 2. Kode Rak/Floor (Mandatory) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* 1. Kode Gudang (Mandatory) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    1. Kode Gudang <span className="text-rose-400 font-bold">*</span>
                  </span>
                  <span className="text-[10px] text-rose-400 font-mono">Mandatory</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Contoh: GDG-01, WH-01, ZONA-A"
                    value={warehouseCode}
                    onChange={(e) => setWarehouseCode(e.target.value)}
                    className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono uppercase placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                {/* Presets buttons */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-slate-500">Pilih Cepat:</span>
                  {['GDG-01', 'GDG-02', 'ZONA-A', 'ZONA-B', 'ZONA-C', 'ZONA-D'].map((code) => (
                    <button
                      type="button"
                      key={code}
                      onClick={() => {
                        setWarehouseCode(code);
                        if (code === 'GDG-01') setWarehouseName('Gudang Pusat Cikarang');
                        if (code === 'GDG-02') setWarehouseName('Gudang Transit Surabaya');
                      }}
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                        warehouseCode === code
                          ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 font-bold'
                          : 'bg-[#0A0B0E] text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Kode Rak/Floor (Mandatory) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-indigo-400" />
                    2. Kode Rak/Floor <span className="text-rose-400 font-bold">*</span>
                  </span>
                  <span className="text-[10px] text-rose-400 font-mono">Mandatory</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Contoh: RAK-01, FLOOR-01, FLR-STAGING, R-05"
                    value={rackOrFloorCode}
                    onChange={(e) => setRackOrFloorCode(e.target.value)}
                    className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono uppercase placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-slate-500">Preset:</span>
                  {['RAK-01', 'RAK-02', 'RAK-03', 'RAK-04', 'FLOOR-01', 'FLR-STG'].map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => setRackOrFloorCode(preset)}
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                        rackOrFloorCode === preset
                          ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 font-bold'
                          : 'bg-[#0A0B0E] text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Row 2: 3. Lorong, 4. Level, 5. Palet (Optional Fields) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              
              {/* 3. Lorong */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  3. Lorong (Aisle)
                </label>
                <input
                  type="text"
                  placeholder="Misal: 01, 02, L01, Aisle-A"
                  value={aisle}
                  onChange={(e) => setAisle(e.target.value)}
                  className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono uppercase placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* 4. Level */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  4. Level (Tier/Tingkat)
                </label>
                <input
                  type="text"
                  placeholder="Misal: 1, 2, 3, 4, Floor, LV1"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono uppercase placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* 5. Palet */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  5. Palet (Slot Palet/Bin)
                </label>
                <input
                  type="text"
                  placeholder="Misal: P01, A1, B2, PL-01"
                  value={pallet}
                  onChange={(e) => setPallet(e.target.value)}
                  className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono uppercase placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

            </div>

          </div>

          {/* Live Code Preview Card */}
          <div className="p-3.5 rounded-lg bg-[#0A0B0E] border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block">
                Kode Locator WMS Terintegrasi:
              </span>
              <div className="text-base font-mono font-bold text-white tracking-wide mt-0.5">
                {generatedCode || '<LENGKAPI_KODE_GUDANG_&_RAK>'}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isDuplicate ? (
                <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-400 text-xs font-mono font-bold border border-rose-500/40 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Sudah Ada
                </span>
              ) : generatedCode.length > 3 ? (
                <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-mono font-bold border border-emerald-500/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Kode Valid
                </span>
              ) : null}
            </div>
          </div>

          {/* Locator Details & Attributes */}
          <div className="p-4 rounded-lg bg-[#0A0B0E] border border-slate-800 space-y-4">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5 text-indigo-400" />
              Atribut & Konfigurasi Penyimpanan:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              
              {/* Storage Type */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Tipe Penyimpanan:</label>
                <select
                  value={storageType}
                  onChange={(e) => setStorageType(e.target.value as any)}
                  className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="RACK">Rak Standar (Tier Racking)</option>
                  <option value="FLOOR">Floor Storage (Lantai/Staging)</option>
                  <option value="PALLET_BULK">Palet Berat (Heavy Duty Bulk)</option>
                  <option value="STAGING">Staging Area (Dock Masuk/Keluar)</option>
                </select>
              </div>

              {/* Max Capacity */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Kapasitas Maksimal (Unit):</label>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={maxCapacityUnits}
                  onChange={(e) => setMaxCapacityUnits(parseInt(e.target.value) || 100)}
                  className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Temperature Type */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Suhu / Lingkungan:</label>
                <select
                  value={temperatureType}
                  onChange={(e) => setTemperatureType(e.target.value as any)}
                  className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="AMBIENT">Suhu Ruang (Ambient)</option>
                  <option value="AIR_CONDITIONED">Berpendingin AC (18-22°C)</option>
                  <option value="COLD_STORAGE">Cold Storage (Chiller/Freezer)</option>
                  <option value="HAZARDOUS">Bahan Kimia / B3 (Ventilasi Khusus)</option>
                </select>
              </div>

            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Catatan / Keterangan Lokasi:</label>
              <input
                type="text"
                placeholder="Contoh: Dekat akses forklift gate barat, baris depan untuk fast picking"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-800 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !warehouseCode.trim() || !rackOrFloorCode.trim() || isDuplicate}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Simpan Locator Baru</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
