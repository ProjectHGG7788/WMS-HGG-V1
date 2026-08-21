import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Layers,
  MapPin,
  Package,
  RefreshCw,
  Trash2,
  FileDown,
  Info,
  Sliders,
  Check,
  Search,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import {
  downloadOpbalTemplate,
  downloadMasterItemTemplate,
  downloadMasterLocatorTemplate,
  downloadAllInOneTemplate,
  exportCurrentDatabaseToExcel,
} from '../utils/excelTemplates';

type ImportCategory = 'OPBAL' | 'ITEMS' | 'LOCATORS';
type ImportMode = 'replace_all' | 'append_add' | 'merge_update';

interface ParsedRow {
  rowIndex: number;
  data: Record<string, any>;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  status: 'VALID' | 'WARNING' | 'ERROR';
}

export const MasterDataOpbalUploader: React.FC<{ onNavigateToTab?: (tabId: string) => void }> = ({
  onNavigateToTab,
}) => {
  const {
    items,
    locators,
    transactions,
    importOpbalData,
    importMasterItemsData,
    importMasterLocatorsData,
    cleanSlateDatabase,
    refreshData,
    isLoading,
  } = useInventory();

  const [activeCategory, setActiveCategory] = useState<ImportCategory>('OPBAL');
  const [importMode, setImportMode] = useState<ImportMode>('replace_all');
  const [generalNotes, setGeneralNotes] = useState('Saldo Awal Implementasi WMS Go-Live');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<{
    success: boolean;
    message: string;
    created?: number;
    updated?: number;
  } | null>(null);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawWorkbook, setRawWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'VALID' | 'WARNING' | 'ERROR'>('ALL');
  const [searchPreview, setSearchPreview] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [cleanKeepLocators, setCleanKeepLocators] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse Excel file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const processSelectedFile = (selectedFile: File) => {
    setFile(selectedFile);
    setProcessResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary', cellDates: true });
        setRawWorkbook(wb);
        setSheetNames(wb.SheetNames);

        // Auto select sheet based on category
        let defaultSheet = wb.SheetNames[0];
        if (activeCategory === 'OPBAL') {
          const matched = wb.SheetNames.find((s) => /opbal|stok|saldo/i.test(s));
          if (matched) defaultSheet = matched;
        } else if (activeCategory === 'ITEMS') {
          const matched = wb.SheetNames.find((s) => /item|barang|produk/i.test(s));
          if (matched) defaultSheet = matched;
        } else if (activeCategory === 'LOCATORS') {
          const matched = wb.SheetNames.find((s) => /lokasi|locator|rak/i.test(s));
          if (matched) defaultSheet = matched;
        }

        setSelectedSheet(defaultSheet);
        parseSheetData(wb, defaultSheet, activeCategory);
      } catch (err: any) {
        setProcessResult({
          success: false,
          message: `Gagal membaca file Excel: ${err?.message || 'Format tidak valid'}`,
        });
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const parseSheetData = (wb: XLSX.WorkBook, sheetName: string, category: ImportCategory) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

    const validatedList: ParsedRow[] = rawJson.map((row, index) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (category === 'OPBAL') {
        const sku = String(row.sku || row['Kode SKU *'] || row['Kode SKU'] || '').trim();
        const name = String(row.name || row['Nama Barang *'] || row['Nama Barang'] || '').trim();
        const rawStock = row.stock !== undefined && row.stock !== '' ? row.stock : (row['Stok Awal (Qty) *'] !== undefined && row['Stok Awal (Qty) *'] !== '' ? row['Stok Awal (Qty) *'] : row['Stok Awal']);
        const stock = Number(rawStock);
        const location = String(row.locationCode || row['Kode Lokasi Rak (WMS)'] || row['Kode Lokasi'] || '').trim();

        if (!sku) errors.push('Kode SKU wajib diisi');
        if (!name) errors.push('Nama Barang wajib diisi');
        if (isNaN(stock) || stock < 0) errors.push('Stok Awal harus berupa angka >= 0');
        if (!location) warnings.push('Lokasi tidak diisi, akan otomatis masuk Staging Default');

        // Check if SKU exists
        const exists = items.some((i) => i.sku.toLowerCase() === sku.toLowerCase());
        if (exists) {
          warnings.push('SKU sudah ada di database (akan diperbarui)');
        }
      } else if (category === 'ITEMS') {
        const sku = String(row.sku || row['Kode SKU *'] || row['Kode SKU'] || '').trim();
        const name = String(row.name || row['Nama Barang *'] || row['Nama Barang'] || '').trim();
        const unit = String(row.unit || row['Satuan *'] || row['Satuan'] || '').trim();

        if (!sku) errors.push('Kode SKU wajib diisi');
        if (!name) errors.push('Nama Barang wajib diisi');
        if (!unit) warnings.push('Satuan kosong, default: Pcs');
      } else if (category === 'LOCATORS') {
        const wh = String(row.warehouseCode || row['Kode Gudang *'] || row['Kode Gudang'] || '').trim();
        const rack = String(row.rackOrFloorCode || row['Kode Rak / Floor *'] || row['Kode Rak / Floor'] || '').trim();

        if (!wh) errors.push('Kode Gudang (Mandatory) wajib diisi');
        if (!rack) errors.push('Kode Rak/Floor (Mandatory) wajib diisi');
      }

      let status: 'VALID' | 'WARNING' | 'ERROR' = 'VALID';
      if (errors.length > 0) status = 'ERROR';
      else if (warnings.length > 0) status = 'WARNING';

      return {
        rowIndex: index + 2, // Excel row index
        data: row,
        isValid: errors.length === 0,
        errors,
        warnings,
        status,
      };
    });

    setParsedRows(validatedList);
  };

  const handleCategorySwitch = (category: ImportCategory) => {
    setActiveCategory(category);
    setProcessResult(null);
    if (rawWorkbook && selectedSheet) {
      parseSheetData(rawWorkbook, selectedSheet, category);
    }
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (rawWorkbook) {
      parseSheetData(rawWorkbook, sheetName, activeCategory);
    }
  };

  // Submit and execute import
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;

    const validRows = parsedRows.filter((r) => r.isValid).map((r) => r.data);
    if (validRows.length === 0) {
      setProcessResult({
        success: false,
        message: 'Tidak ada baris data yang valid untuk diimpor. Harap periksa format kolom.',
      });
      return;
    }

    setIsProcessing(true);
    setProcessResult(null);

    try {
      if (activeCategory === 'OPBAL') {
        const res = await importOpbalData(validRows, importMode, generalNotes);
        setProcessResult({
          success: res.success,
          message: res.message,
          created: res.createdCount,
          updated: res.updatedCount,
        });
      } else if (activeCategory === 'ITEMS') {
        const res = await importMasterItemsData(validRows);
        setProcessResult({
          success: res.success,
          message: res.message,
          created: res.createdCount,
          updated: res.updatedCount,
        });
      } else if (activeCategory === 'LOCATORS') {
        const res = await importMasterLocatorsData(validRows);
        setProcessResult({
          success: res.success,
          message: res.message,
          created: res.createdCount,
          updated: res.updatedCount,
        });
      }
    } catch (err: any) {
      setProcessResult({
        success: false,
        message: err?.message || 'Terjadi kesalahan sistem saat proses data.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCleanSlate = async () => {
    setIsProcessing(true);
    try {
      const res = await cleanSlateDatabase(cleanKeepLocators);
      setShowCleanModal(false);
      setProcessResult({
        success: res.success,
        message: 'Database berhasil dikosongkan. Sistem sekarang siap menerima Opening Balance baru.',
      });
    } catch {
      setProcessResult({
        success: false,
        message: 'Gagal mengosongkan database.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter preview rows
  const filteredRows = parsedRows.filter((row) => {
    if (previewFilter === 'VALID' && row.status !== 'VALID') return false;
    if (previewFilter === 'WARNING' && row.status !== 'WARNING') return false;
    if (previewFilter === 'ERROR' && row.status !== 'ERROR') return false;

    if (searchPreview.trim()) {
      const query = searchPreview.toLowerCase();
      const stringified = JSON.stringify(row.data).toLowerCase();
      return stringified.includes(query);
    }
    return true;
  });

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const warningCount = parsedRows.filter((r) => r.status === 'WARNING').length;
  const errorCount = parsedRows.filter((r) => r.status === 'ERROR').length;

  return (
    <div id="master-opbal-uploader" className="space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Upload Data Master & Opening Balance (Opbal)
              </h1>
              <p className="text-sm text-slate-500">
                Modul inisialisasi awal sistem WMS: Upload Stok Awal, Master Produk & Master Lokasi via Excel (.xlsx / .csv)
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => exportCurrentDatabaseToExcel(items, locators)}
            className="px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-2 transition"
            title="Download cadangan data saat ini ke Excel"
          >
            <FileDown className="w-4 h-4 text-slate-600" />
            Backup Database (.xlsx)
          </button>

          <button
            onClick={() => setShowCleanModal(true)}
            className="px-3.5 py-2 text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-2 transition"
            title="Kosongkan data simulasi sebelum mulai upload saldo awal real"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            Reset Data Awal
          </button>

          <button
            onClick={refreshData}
            disabled={isLoading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition"
            title="Refresh database"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Live System Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Master SKU</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{items.length}</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stok Fisik Total</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {items.reduce((acc, curr) => acc + curr.stock, 0).toLocaleString('id-ID')}
            </p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Master Locator Rak</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{locators.length}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Riwayat Transaksi</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{transactions.length}</p>
          </div>
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Category Navigation Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-1.5 gap-2 overflow-x-auto">
          <button
            onClick={() => handleCategorySwitch('OPBAL')}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-lg text-sm font-semibold whitespace-nowrap transition ${
              activeCategory === 'OPBAL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Database className="w-4 h-4" />
            1. Data Stok Awal (Opening Balance)
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                activeCategory === 'OPBAL' ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              Prioritas Go-Live
            </span>
          </button>

          <button
            onClick={() => handleCategorySwitch('ITEMS')}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-lg text-sm font-semibold whitespace-nowrap transition ${
              activeCategory === 'ITEMS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Package className="w-4 h-4" />
            2. Master Item & Produk
          </button>

          <button
            onClick={() => handleCategorySwitch('LOCATORS')}
            className={`flex items-center gap-2.5 px-5 py-3 rounded-lg text-sm font-semibold whitespace-nowrap transition ${
              activeCategory === 'LOCATORS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <MapPin className="w-4 h-4" />
            3. Master Lokasi & Rak (Locators)
          </button>
        </div>

        {/* Template Download & Guide Banner */}
        <div className="p-6 bg-slate-50/50 border-b border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                <Info className="w-4 h-4 text-blue-600" />
                <span>
                  {activeCategory === 'OPBAL' && 'Petunjuk Upload Saldo Awal (Opbal)'}
                  {activeCategory === 'ITEMS' && 'Petunjuk Upload Master Item & Produk'}
                  {activeCategory === 'LOCATORS' && 'Petunjuk Upload Master Lokasi Gudang'}
                </span>
              </div>
              <p className="text-xs text-slate-600 max-w-2xl">
                {activeCategory === 'OPBAL' &&
                  'Gunakan template resmi Opbal. Kolom wajib: Kode SKU, Nama Barang, Stok Awal (Qty), dan Satuan. Sistem otomatis mencatat log penyesuaian saldo awal.'}
                {activeCategory === 'ITEMS' &&
                  'Upload katalog master produk lengkap termasuk dimensi (P x L x T), berat, kubikasi (CBM), safety stock, dan klasifikasi ABC.'}
                {activeCategory === 'LOCATORS' &&
                  'Upload struktur rak gudang: Kode Gudang (Mandatory), Kode Rak/Floor (Mandatory), Lorong, Level, Palet untuk pelacakan barang yang presisi.'}
              </p>
            </div>

            {/* Template Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {activeCategory === 'OPBAL' && (
                <button
                  onClick={downloadOpbalTemplate}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  Download Template Opbal (.xlsx)
                </button>
              )}

              {activeCategory === 'ITEMS' && (
                <button
                  onClick={downloadMasterItemTemplate}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  Download Template Master Item (.xlsx)
                </button>
              )}

              {activeCategory === 'LOCATORS' && (
                <button
                  onClick={downloadMasterLocatorTemplate}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  Download Template Master Lokasi (.xlsx)
                </button>
              )}

              <button
                onClick={downloadAllInOneTemplate}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition"
                title="Satu file Excel yang memuat 3 sheet sekaligus"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                Template Lengkap Multi-Sheet (3-in-1)
              </button>
            </div>
          </div>
        </div>

        {/* Upload Dropzone */}
        <div className="p-6 space-y-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50'
                : file
                ? 'border-emerald-300 bg-emerald-50/30'
                : 'border-slate-300 hover:border-blue-400 bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              className={`p-4 rounded-full ${
                file ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {file ? <FileSpreadsheet className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
            </div>

            <div>
              <p className="text-base font-semibold text-slate-800">
                {file ? file.name : 'Tarik & Letakkan File Excel di Sini atau Klik untuk Pilih'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Mendukung format Microsoft Excel (*.xlsx, *.xls) dan CSV (*.csv)
              </p>
              {file && (
                <p className="text-xs font-medium text-emerald-600 mt-1">
                  Ukuran: {(file.size / 1024).toFixed(1)} KB • Terbaca {parsedRows.length} baris data
                </p>
              )}
            </div>
          </div>

          {/* Sheet Selector (if multiple sheets exist) */}
          {sheetNames.length > 1 && (
            <div className="flex items-center gap-3 p-3 bg-slate-100/80 rounded-lg border border-slate-200 text-sm">
              <span className="font-semibold text-slate-700">Pilih Lembar Kerja (Sheet):</span>
              <div className="flex flex-wrap gap-2">
                {sheetNames.map((sheet) => (
                  <button
                    key={sheet}
                    type="button"
                    onClick={() => handleSheetChange(sheet)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                      selectedSheet === sheet
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                    }`}
                  >
                    {sheet}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Opbal Mode Settings (Only for Opbal category) */}
          {activeCategory === 'OPBAL' && parsedRows.length > 0 && (
            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                <Sliders className="w-4 h-4 text-blue-600" />
                <span>Pengaturan Mode Sinkronisasi Saldo Awal</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label
                  className={`p-3 rounded-lg border cursor-pointer flex flex-col gap-1 transition ${
                    importMode === 'replace_all'
                      ? 'bg-white border-blue-500 ring-2 ring-blue-200 shadow-xs'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      1. Timpa / Tetapkan Saldo (Rekomendasi)
                    </span>
                    <input
                      type="radio"
                      name="opbal_mode"
                      checked={importMode === 'replace_all'}
                      onChange={() => setImportMode('replace_all')}
                      className="text-blue-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Stok sistem disesuaikan persis dengan angka di Excel Opbal.
                  </p>
                </label>

                <label
                  className={`p-3 rounded-lg border cursor-pointer flex flex-col gap-1 transition ${
                    importMode === 'append_add'
                      ? 'bg-white border-blue-500 ring-2 ring-blue-200 shadow-xs'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      2. Tambahkan ke Stok Berjalan
                    </span>
                    <input
                      type="radio"
                      name="opbal_mode"
                      checked={importMode === 'append_add'}
                      onChange={() => setImportMode('append_add')}
                      className="text-blue-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Kuantitas Opbal akan ditambahkan ke stok yang telah ada.
                  </p>
                </label>

                <label
                  className={`p-3 rounded-lg border cursor-pointer flex flex-col gap-1 transition ${
                    importMode === 'merge_update'
                      ? 'bg-white border-blue-500 ring-2 ring-blue-200 shadow-xs'
                      : 'bg-white/60 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      3. Sinkronisasi Data Saja
                    </span>
                    <input
                      type="radio"
                      name="opbal_mode"
                      checked={importMode === 'merge_update'}
                      onChange={() => setImportMode('merge_update')}
                      className="text-blue-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Hanya perbarui master info & lokasi tanpa mengubah saldo stok.
                  </p>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan / Keterangan Dokumen Opbal:
                </label>
                <input
                  type="text"
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  placeholder="e.g. Saldo Awal Audit Fisik Gudang 2026"
                  className="w-full text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Process Result Message */}
          {processResult && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 ${
                processResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {processResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1 flex-1">
                <p className="text-sm font-semibold">{processResult.message}</p>
                {processResult.success && onNavigateToTab && (
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => onNavigateToTab('inventory')}
                      className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition"
                    >
                      Lihat Daftar Stok SKU Terkini →
                    </button>
                    <button
                      onClick={() => onNavigateToTab('locators')}
                      className="text-xs px-3 py-1.5 bg-white hover:bg-slate-100 text-emerald-800 border border-emerald-300 font-medium rounded-lg transition"
                    >
                      Lihat Master Locator Rak →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Data Validation & Preview Section */}
          {parsedRows.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Hasil Verifikasi Data ({parsedRows.length} Baris Terdeteksi)
                  </h3>
                </div>

                {/* Filter & Search Bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchPreview}
                      onChange={(e) => setSearchPreview(e.target.value)}
                      placeholder="Cari SKU / Nama..."
                      className="pl-8 pr-3 py-1.5 text-xs bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                    <button
                      onClick={() => setPreviewFilter('ALL')}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${
                        previewFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      Semua ({parsedRows.length})
                    </button>
                    <button
                      onClick={() => setPreviewFilter('VALID')}
                      className={`px-2.5 py-1 rounded-md font-medium transition ${
                        previewFilter === 'VALID' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700'
                      }`}
                    >
                      Valid ({validCount})
                    </button>
                    {warningCount > 0 && (
                      <button
                        onClick={() => setPreviewFilter('WARNING')}
                        className={`px-2.5 py-1 rounded-md font-medium transition ${
                          previewFilter === 'WARNING' ? 'bg-amber-500 text-white shadow-xs' : 'text-amber-700'
                        }`}
                      >
                        Peringatan ({warningCount})
                      </button>
                    )}
                    {errorCount > 0 && (
                      <button
                        onClick={() => setPreviewFilter('ERROR')}
                        className={`px-2.5 py-1 rounded-md font-medium transition ${
                          previewFilter === 'ERROR' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700'
                        }`}
                      >
                        Error ({errorCount})
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs max-h-96 overflow-y-auto bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="p-3 w-12 text-center">Baris</th>
                      <th className="p-3 w-28">Status</th>
                      <th className="p-3">Kode SKU / ID</th>
                      <th className="p-3">Nama Barang / Deskripsi</th>
                      {activeCategory === 'OPBAL' && <th className="p-3 text-right">Stok Awal</th>}
                      {activeCategory === 'OPBAL' && <th className="p-3">Satuan</th>}
                      <th className="p-3">Lokasi / Rak</th>
                      {activeCategory === 'ITEMS' && <th className="p-3">Kategori</th>}
                      <th className="p-3">Keterangan / Diagnostik</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-400">
                          Tidak ada baris data yang cocok dengan filter.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => {
                        const d = row.data;
                        const sku = d.sku || d['Kode SKU *'] || d['Kode SKU'] || d.id || d['ID Locator'] || '-';
                        const name = d.name || d['Nama Barang *'] || d['Nama Barang'] || d['Nama Gudang'] || d['Kode Rak / Floor *'] || '-';
                        const qty = d.stock !== undefined && d.stock !== '' ? d.stock : (d['Stok Awal (Qty) *'] !== undefined && d['Stok Awal (Qty) *'] !== '' ? d['Stok Awal (Qty) *'] : d['Stok Awal']);
                        const unit = d.unit || d['Satuan *'] || d['Satuan'] || 'Pcs';
                        const loc = d.locationCode || d['Kode Lokasi Rak (WMS)'] || d['Kode Lokasi'] || d['Kode Full (Opsional)'] || d['Kode Full'] || '-';
                        const cat = d.category || d['Kategori *'] || d['Kategori'] || '-';

                        return (
                          <tr
                            key={row.rowIndex}
                            className={`hover:bg-slate-50/80 transition ${
                              row.status === 'ERROR'
                                ? 'bg-rose-50/40'
                                : row.status === 'WARNING'
                                ? 'bg-amber-50/30'
                                : ''
                            }`}
                          >
                            <td className="p-3 text-center text-slate-500 font-mono">
                              #{row.rowIndex}
                            </td>
                            <td className="p-3">
                              {row.status === 'VALID' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                  <Check className="w-3 h-3" /> Siap Import
                                </span>
                              )}
                              {row.status === 'WARNING' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800">
                                  <AlertTriangle className="w-3 h-3" /> Warning
                                </span>
                              )}
                              {row.status === 'ERROR' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-100 text-rose-800">
                                  <XCircle className="w-3 h-3" /> Error
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-semibold font-mono text-slate-900">{sku}</td>
                            <td className="p-3 font-medium text-slate-800 max-w-xs truncate">{name}</td>
                            {activeCategory === 'OPBAL' && (
                              <td className="p-3 text-right font-bold text-slate-900">
                                {qty !== undefined ? Number(qty).toLocaleString('id-ID') : '-'}
                              </td>
                            )}
                            {activeCategory === 'OPBAL' && (
                              <td className="p-3 text-slate-600">{unit}</td>
                            )}
                            <td className="p-3 font-mono text-xs text-blue-700">{loc}</td>
                            {activeCategory === 'ITEMS' && (
                              <td className="p-3 text-slate-600">{cat}</td>
                            )}
                            <td className="p-3 text-xs">
                              {row.errors.length > 0 && (
                                <span className="text-rose-600 font-medium">
                                  {row.errors.join(', ')}
                                </span>
                              )}
                              {row.warnings.length > 0 && (
                                <span className="text-amber-700 font-medium">
                                  {row.warnings.join(', ')}
                                </span>
                              )}
                              {row.errors.length === 0 && row.warnings.length === 0 && (
                                <span className="text-slate-400">Format valid</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Bottom Action Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200">
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p>
                    <span className="font-semibold text-emerald-700">{validCount} baris valid</span> siap
                    dimasukkan ke database sistem WMS.
                  </p>
                  {errorCount > 0 && (
                    <p className="text-rose-600">
                      * {errorCount} baris memiliki kesalahan data dan akan dilewati secara otomatis.
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setParsedRows([]);
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                  >
                    Batal / Hapus File
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={isProcessing || validCount === 0}
                    className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center gap-2 transition"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Memproses Data...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Simpan {activeCategory === 'OPBAL' ? 'Opening Balance' : activeCategory === 'ITEMS' ? 'Master Item' : 'Master Lokasi'} ke Sistem
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clean Slate Confirmation Modal */}
      {showCleanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Reset Database Sistem</h3>
            </div>

            <p className="text-sm text-slate-600">
              Tindakan ini akan mengosongkan seluruh data inventaris dan riwayat transaksi simulasi. Gunakan opsi ini sebelum Anda mengunggah file Opening Balance real untuk memulai penggunaan sistem secara fresh.
            </p>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanKeepLocators}
                  onChange={(e) => setCleanKeepLocators(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                Pertahankan Master Locator / Rak (Hanya kosongkan stok & barang)
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCleanModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCleanSlate}
                disabled={isProcessing}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition flex items-center gap-1.5"
              >
                {isProcessing ? 'Mereset...' : 'Ya, Kosongkan Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
