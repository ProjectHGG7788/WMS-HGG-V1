import React, { useState, useMemo } from 'react';
import {
  X,
  FileSpreadsheet,
  FileText,
  Warehouse,
  CheckSquare,
  Square,
  Download,
  Boxes,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Info,
  Building2,
  Printer
} from 'lucide-react';
import { InventoryItem, WarehouseLocator } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatNumber, formatCbm, formatCbmValue } from '../utils/formatters';
import {
  getAvailableWarehouseList,
  resolveItemWarehouseCode,
  exportStockToExcel,
  exportStockToPDF,
  WarehouseInfo,
} from '../utils/exportStockUtils';

interface StockExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allItems: InventoryItem[];
  tableFilteredItems: InventoryItem[];
  locators: WarehouseLocator[];
  currentSearchQuery?: string;
  currentCategoryFilter?: string;
}

export const StockExportModal: React.FC<StockExportModalProps> = ({
  isOpen,
  onClose,
  allItems,
  tableFilteredItems,
  locators,
  currentSearchQuery = '',
  currentCategoryFilter = 'ALL',
}) => {
  const { currentUser } = useAuth();

  // All available warehouses with computed stats
  const availableWarehouses = useMemo(() => {
    return getAvailableWarehouseList(allItems, locators);
  }, [allItems, locators]);

  // Selected warehouse codes (defaults to all warehouses selected)
  const [selectedWarehouseCodes, setSelectedWarehouseCodes] = useState<string[]>(() =>
    availableWarehouses.map((w) => w.code)
  );

  // Data scope: 'ALL_IN_SELECTED_WAREHOUSES' vs 'TABLE_FILTERED_ONLY'
  const [dataScope, setDataScope] = useState<'ALL_IN_SELECTED_WAREHOUSES' | 'TABLE_FILTERED_ONLY'>(
    'ALL_IN_SELECTED_WAREHOUSES'
  );

  // Preferred format
  const [exportFormat, setExportFormat] = useState<'EXCEL' | 'PDF'>('EXCEL');

  // Column / Sheet options
  const [includeCbm, setIncludeCbm] = useState(true);
  const [includeAging, setIncludeAging] = useState(true);
  const [includeBatchLot, setIncludeBatchLot] = useState(true);
  const [includeLocatorsSheet, setIncludeLocatorsSheet] = useState(true);

  // Success / Status feedback
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Toggle single warehouse selection
  const handleToggleWarehouse = (code: string) => {
    setSelectedWarehouseCodes((prev) => {
      if (prev.includes(code)) {
        return prev.filter((c) => c !== code);
      } else {
        return [...prev, code];
      }
    });
  };

  // Select all warehouses
  const handleSelectAllWarehouses = () => {
    setSelectedWarehouseCodes(availableWarehouses.map((w) => w.code));
  };

  // Clear all warehouses
  const handleClearAllWarehouses = () => {
    setSelectedWarehouseCodes([]);
  };

  // Determine base item list based on scope
  const baseItems = dataScope === 'TABLE_FILTERED_ONLY' ? tableFilteredItems : allItems;

  // Filter items matching selected warehouses
  const exportedItems = useMemo(() => {
    return baseItems.filter((item) =>
      selectedWarehouseCodes.includes(resolveItemWarehouseCode(item, locators))
    );
  }, [baseItems, selectedWarehouseCodes, locators]);

  const totalExportUnits = exportedItems.reduce((acc, it) => acc + it.stock, 0);
  const totalExportCbm = exportedItems.reduce((acc, it) => acc + (it.stock * (it.cbmPerUnit || 0)), 0);

  // Handle Export Excel
  const handleExportExcel = () => {
    if (selectedWarehouseCodes.length === 0) return;
    setIsExporting(true);
    try {
      const scopeNote =
        dataScope === 'TABLE_FILTERED_ONLY'
          ? `Filter Tabel Aktif (Pencarian: "${currentSearchQuery || '-'}", Kategori: ${currentCategoryFilter})`
          : 'Semua SKU Terdaftar di Gudang Terpilih';

      const res = exportStockToExcel(baseItems, locators, {
        selectedWarehouseCodes,
        includeCbm,
        includeAging,
        includeBatchLot,
        includeLocatorsSheet,
        scopeNote,
      });

      setSuccessMessage(`Berhasil mengunduh Excel: ${res.filename} (${formatNumber(res.totalExported)} SKU)`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Export Excel failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Export PDF
  const handleExportPDF = () => {
    if (selectedWarehouseCodes.length === 0) return;
    setIsExporting(true);
    try {
      const scopeNote =
        dataScope === 'TABLE_FILTERED_ONLY'
          ? `Filter Tabel Aktif (Pencarian: "${currentSearchQuery || '-'}", Kategori: ${currentCategoryFilter})`
          : undefined;

      const res = exportStockToPDF(
        baseItems,
        locators,
        {
          selectedWarehouseCodes,
          includeCbm,
          includeAging,
          includeBatchLot,
          scopeNote,
        },
        currentUser
      );

      setSuccessMessage(`Berhasil mengunduh PDF: ${res.filename} (${formatNumber(res.totalExported)} SKU)`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Export PDF failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-stock-export"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl bg-[#14161B] border border-slate-800 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-[#0A0B0E]/80 flex items-center justify-between gap-4 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Tarik Data & Export Stok SKU</span>
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-bold uppercase">
                  Multi-Gudang
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Pilih gudang yang ingin ditarik datanya, lalu unduh dalam format Excel spreadsheet atau PDF siap cetak.
              </p>
            </div>
          </div>
          <button
            id="btn-close-export-modal"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
          
          {/* Notification Feedback */}
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {/* Section 1: Warehouse Filter Checkboxes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                <span className="font-bold text-slate-200 text-xs uppercase tracking-wider">
                  1. Pilih Gudang yang Mau Di-export ({selectedWarehouseCodes.length}/{availableWarehouses.length} Gudang)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllWarehouses}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium transition-colors cursor-pointer text-[11px]"
                >
                  Pilih Semua Gudang
                </button>
                <button
                  type="button"
                  onClick={handleClearAllWarehouses}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-medium transition-colors cursor-pointer text-[11px]"
                >
                  Hapus Pilihan
                </button>
              </div>
            </div>

            {/* Warehouse Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {availableWarehouses.map((wh) => {
                const isSelected = selectedWarehouseCodes.includes(wh.code);
                return (
                  <div
                    key={wh.code}
                    onClick={() => handleToggleWarehouse(wh.code)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between select-none ${
                      isSelected
                        ? 'bg-indigo-950/25 border-indigo-500/50 shadow-sm ring-1 ring-indigo-500/30'
                        : 'bg-[#0A0B0E] border-slate-800 hover:border-slate-700 opacity-60'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="px-2 py-0.5 rounded text-[11px] font-bold font-mono border"
                            style={{
                              backgroundColor: `${wh.color}15`,
                              borderColor: `${wh.color}40`,
                              color: wh.color,
                            }}
                          >
                            {wh.code}
                          </span>
                        </div>
                        <div className="text-indigo-400">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </div>
                      </div>

                      <div className="font-bold text-white text-xs mt-2 truncate">
                        {wh.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {wh.typeLabel}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">{formatNumber(wh.itemCount)} SKU</span>
                      <span className="text-emerald-400 font-bold">{formatNumber(wh.totalUnits)} Qty</span>
                      <span className="text-indigo-300">{formatCbm(wh.totalCbm)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedWarehouseCodes.length === 0 && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Peringatan: Silakan centang minimal satu gudang untuk dapat mengekspor data stok.</span>
              </div>
            )}
          </div>

          {/* Section 2: Data Scope */}
          <div className="p-3.5 rounded-xl bg-[#0A0B0E] border border-slate-800 space-y-2.5">
            <div className="font-bold text-slate-300 text-xs uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>2. Cakupan Data yang Ditarik</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`p-3 rounded-lg border flex items-start gap-2.5 cursor-pointer transition-colors ${
                  dataScope === 'ALL_IN_SELECTED_WAREHOUSES'
                    ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                    : 'bg-[#14161B] border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="dataScope"
                  checked={dataScope === 'ALL_IN_SELECTED_WAREHOUSES'}
                  onChange={() => setDataScope('ALL_IN_SELECTED_WAREHOUSES')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-bold text-xs">Semua SKU di Gudang Terpilih</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Mengekspor seluruh stok tanpa terpengaruh filter pencarian atau kategori di tabel saat ini.
                  </div>
                </div>
              </label>

              <label
                className={`p-3 rounded-lg border flex items-start gap-2.5 cursor-pointer transition-colors ${
                  dataScope === 'TABLE_FILTERED_ONLY'
                    ? 'bg-indigo-600/10 border-indigo-500/40 text-white'
                    : 'bg-[#14161B] border-slate-800 text-slate-400 hover:text-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="dataScope"
                  checked={dataScope === 'TABLE_FILTERED_ONLY'}
                  onChange={() => setDataScope('TABLE_FILTERED_ONLY')}
                  className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-bold text-xs">Hanya SKU Hasil Filter Tabel ({tableFilteredItems.length} SKU)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Mempertahankan kata kunci pencarian (&quot;{currentSearchQuery || 'Semua'}&quot;) dan filter kategori aktif.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Section 3: Format & Column Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Format Selection Cards */}
            <div className="p-3.5 rounded-xl bg-[#0A0B0E] border border-slate-800 space-y-2.5">
              <div className="font-bold text-slate-300 text-xs uppercase tracking-wider flex items-center gap-2">
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                <span>3. Format Dokumen Target</span>
              </div>

              <div className="space-y-2">
                <div
                  onClick={() => setExportFormat('EXCEL')}
                  className={`p-3 rounded-lg border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                    exportFormat === 'EXCEL'
                      ? 'bg-emerald-950/20 border-emerald-500/50 text-white ring-1 ring-emerald-500/30'
                      : 'bg-[#14161B] border-slate-800 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">Microsoft Excel (.xlsx)</div>
                      <div className="text-[10px] text-slate-400">Spreadsheet detail + Ringkasan per Gudang</div>
                    </div>
                  </div>
                  {exportFormat === 'EXCEL' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>

                <div
                  onClick={() => setExportFormat('PDF')}
                  className={`p-3 rounded-lg border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                    exportFormat === 'PDF'
                      ? 'bg-indigo-950/20 border-indigo-500/50 text-white ring-1 ring-indigo-500/30'
                      : 'bg-[#14161B] border-slate-800 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">Dokumen PDF Resmi (.pdf)</div>
                      <div className="text-[10px] text-slate-400">Laporan siap cetak + KPI + Kolom Tanda Tangan</div>
                    </div>
                  </div>
                  {exportFormat === 'PDF' && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                </div>
              </div>
            </div>

            {/* Column Options */}
            <div className="p-3.5 rounded-xl bg-[#0A0B0E] border border-slate-800 space-y-2.5">
              <div className="font-bold text-slate-300 text-xs uppercase tracking-wider flex items-center gap-2">
                <Boxes className="w-3.5 h-3.5 text-indigo-400" />
                <span>4. Opsi Kolom Tambahan</span>
              </div>

              <div className="space-y-2 text-[11px]">
                <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeCbm}
                    onChange={(e) => setIncludeCbm(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Sertakan Kubikasi CBM (m³) & Volume Ruang</span>
                </label>

                <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeAging}
                    onChange={(e) => setIncludeAging(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Sertakan Kolom Aging (Hari) & Tgl Inbound</span>
                </label>

                <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeBatchLot}
                    onChange={(e) => setIncludeBatchLot(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Sertakan Batch Lot & Tanggal Kadaluarsa</span>
                </label>

                <label className="flex items-center gap-2.5 text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeLocatorsSheet}
                    onChange={(e) => setIncludeLocatorsSheet(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Sertakan Sheet Master Locator (Khusus Excel)</span>
                </label>
              </div>
            </div>

          </div>

          {/* Section 4: Live Summary Box */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 font-bold font-mono">
                {selectedWarehouseCodes.length}
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Total Gudang Terpilih</div>
                <div className="font-bold text-white text-xs">
                  {selectedWarehouseCodes.length === 0
                    ? 'Belum ada gudang dipilih'
                    : selectedWarehouseCodes.join(', ')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs font-mono">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-sans">Total SKU</div>
                <div className="font-bold text-white text-sm">{formatNumber(exportedItems.length)} SKU</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-sans">Total Kuantitas</div>
                <div className="font-bold text-emerald-400 text-sm">{formatNumber(totalExportUnits)} Unit</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-sans">Total Kubikasi</div>
                <div className="font-bold text-indigo-400 text-sm">{formatCbm(totalExportCbm)}</div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Action Buttons */}
        <div className="p-4 border-t border-slate-800 bg-[#0A0B0E]/90 flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 z-10">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span>Format angka menggunakan notasi Indonesia (Titik ribuan & Koma desimal).</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              id="btn-cancel-export"
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Tutup
            </button>

            {/* Quick Export Excel Button */}
            <button
              id="btn-confirm-export-excel"
              type="button"
              onClick={handleExportExcel}
              disabled={selectedWarehouseCodes.length === 0 || isExporting}
              className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel (.xlsx)</span>
            </button>

            {/* Quick Export PDF Button */}
            <button
              id="btn-confirm-export-pdf"
              type="button"
              onClick={handleExportPDF}
              disabled={selectedWarehouseCodes.length === 0 || isExporting}
              className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Unduh PDF (.pdf)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
