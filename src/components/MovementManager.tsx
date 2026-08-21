import React, { useState } from 'react';
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Trash2,
  CheckCircle2,
  Printer,
  Search,
  AlertCircle,
  FileText,
  Clock,
  ScanLine,
  MapPin,
  X,
  Layers,
  RefreshCw,
  Boxes,
  HelpCircle,
  Building,
  UserCheck,
  Tag
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { MovementSubType, StockTransaction } from '../types';

interface MovementItemRow {
  sku: string;
  quantity: number;
  fromLocation: string;
  toLocation: string;
  batchLot?: string;
  notes?: string;
}

export const MovementManager: React.FC = () => {
  const { items, locators, transactions, recordBatchMovement, setIsScannerOpen } = useInventory();
  const { currentUser } = useAuth();

  // Tab switcher: 'form' | 'history'
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

  // Transaction Configuration State
  const [movementType, setMovementType] = useState<MovementSubType>('INTERNAL_TRANSFER');
  const [referenceNumber, setReferenceNumber] = useState<string>(
    () => `MOV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`
  );
  const [movementReason, setMovementReason] = useState<string>('Optimasi Kapasitas Rak');
  const [customReason, setCustomReason] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>(
    () => new Date().toISOString().substring(0, 16)
  );
  const [notes, setNotes] = useState<string>('');

  // Default initial SKU & Locations
  const defaultItem = items[0];
  const defaultToLoc = locators.length > 1 ? locators[1].fullCode : (locators[0]?.fullCode || 'GDG01-RAK01-L02-LV1-P01');

  // Multi-SKU Item Rows
  const [itemRows, setItemRows] = useState<MovementItemRow[]>([
    {
      sku: defaultItem?.sku || '',
      quantity: 1,
      fromLocation: defaultItem?.location?.fullCode || 'GDG01-RAK01-L01-LV1-P01',
      toLocation: defaultToLoc,
      batchLot: defaultItem?.batchLot || '',
      notes: ''
    }
  ]);

  // UI Processing & Notifications
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Print Modal State
  const [printedTransaction, setPrintedTransaction] = useState<StockTransaction | null>(null);
  const [selectedTxDetail, setSelectedTxDetail] = useState<StockTransaction | null>(null);

  // History Filters
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Helper generator for Reference Number based on sub-type
  const handleGenerateNewRef = (type: MovementSubType) => {
    const year = new Date().getFullYear();
    const rand = Math.floor(100000 + Math.random() * 900000);
    if (type === 'MOVE_OUT') {
      setReferenceNumber(`MVOUT-${year}-${rand}`);
    } else if (type === 'MOVE_IN') {
      setReferenceNumber(`MVIN-${year}-${rand}`);
    } else {
      setReferenceNumber(`MOV-${year}-${rand}`);
    }
  };

  const handleTypeChange = (newType: MovementSubType) => {
    setMovementType(newType);
    handleGenerateNewRef(newType);

    // Adjust default locations for all rows if needed
    setItemRows(prev => prev.map(row => {
      const itm = items.find(i => i.sku === row.sku);
      if (newType === 'MOVE_OUT') {
        return {
          ...row,
          fromLocation: itm?.location?.fullCode || row.fromLocation,
          toLocation: 'Staging Area Transit / Buffering'
        };
      } else if (newType === 'MOVE_IN') {
        return {
          ...row,
          fromLocation: 'Staging Area Transit / Receiving Dock',
          toLocation: row.toLocation === 'Staging Area Transit / Buffering' ? (locators[0]?.fullCode || 'GDG01-RAK01-L01-LV1-P01') : row.toLocation
        };
      } else {
        return {
          ...row,
          fromLocation: itm?.location?.fullCode || row.fromLocation,
          toLocation: row.toLocation.startsWith('Staging') ? (locators[1]?.fullCode || locators[0]?.fullCode || 'GDG01-RAK01-L02-LV1-P01') : row.toLocation
        };
      }
    }));
  };

  const movementTypeConfig: Record<
    MovementSubType,
    { label: string; icon: any; color: string; desc: string; badgeClass: string; activeClass: string }
  > = {
    INTERNAL_TRANSFER: {
      label: 'Pemindahan Antar Locator (Transfer Internal)',
      icon: ArrowLeftRight,
      color: 'indigo',
      desc: 'Pemindahan langsung stok barang dari Locator Asal ke Locator Tujuan baru dalam satu surat tugas movement.',
      badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
      activeClass: 'border-indigo-500 bg-indigo-500/10 text-white'
    },
    MOVE_OUT: {
      label: 'Move Out (Pengeluaran dari Locator Asal)',
      icon: ArrowUpRight,
      color: 'amber',
      desc: 'Proses picking/pelepasan stok dari locator rak asal menuju staging area pemindahan atau transit pergerakan barang.',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      activeClass: 'border-amber-500 bg-amber-500/10 text-white'
    },
    MOVE_IN: {
      label: 'Move In (Penempatan ke Locator Tujuan / Putaway)',
      icon: ArrowDownLeft,
      color: 'emerald',
      desc: 'Proses penempatan stok fisik dari area staging transit menuju ke locator rak tujuan akhir yang telah ditentukan.',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      activeClass: 'border-emerald-500 bg-emerald-500/10 text-white'
    }
  };

  const reasonOptions = [
    'Optimasi Kapasitas Rak',
    'Relokasi Fast/Slow Moving (ABC Slotting)',
    'Konsolidasi Palet / Bin',
    'Replenishment Area Picking (Forward Pick)',
    'Re-organisasi Tata Letak Gudang',
    'Kerusakan Rak / Pemeliharaan Fasilitas',
    'Penyesuaian Suhu & Kategori Khusus',
    'Karantina & Pemeriksaan Kualitas',
    'Lainnya (Tuliskan Kustom)'
  ];

  // Row Manipulation Handlers
  const handleAddItemRow = () => {
    const defaultSku = items[0]?.sku || '';
    const itm = items.find(i => i.sku === defaultSku);
    const origin = itm?.location?.fullCode || 'GDG01-RAK01-L01-LV1-P01';
    let dest = locators.find(l => l.fullCode !== origin)?.fullCode || 'GDG01-RAK01-L02-LV1-P01';
    if (movementType === 'MOVE_OUT') dest = 'Staging Area Transit / Buffering';
    if (movementType === 'MOVE_IN') {
      // origin staging
    }

    setItemRows(prev => [
      ...prev,
      {
        sku: defaultSku,
        quantity: 1,
        fromLocation: movementType === 'MOVE_IN' ? 'Staging Area Transit' : origin,
        toLocation: dest,
        batchLot: itm?.batchLot || '',
        notes: ''
      }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (itemRows.length === 1) return;
    setItemRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof MovementItemRow, value: any) => {
    setItemRows(prev => {
      const updated = [...prev];
      if (field === 'sku') {
        const itm = items.find(i => i.sku === value);
        const origin = itm?.location?.fullCode || updated[index].fromLocation;
        updated[index] = {
          ...updated[index],
          sku: value,
          fromLocation: movementType === 'MOVE_IN' ? updated[index].fromLocation : origin,
          batchLot: itm?.batchLot || updated[index].batchLot
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  // Metric summaries
  const totalQuantity = itemRows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
  const totalCbm = itemRows.reduce((sum, row) => {
    const itm = items.find(i => i.sku === row.sku);
    const cbm = itm?.cbmPerUnit || 0.001;
    return sum + (cbm * (Number(row.quantity) || 0));
  }, 0);

  // Submit Transaction
  const handleSubmitMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    if (itemRows.length === 0 || totalQuantity <= 0) {
      setFeedbackMsg({ type: 'error', text: 'Daftar barang pergerakan (SKU) tidak boleh kosong.' });
      return;
    }

    // Validate each row
    for (let i = 0; i < itemRows.length; i++) {
      const row = itemRows[i];
      if (!row.sku) {
        setFeedbackMsg({ type: 'error', text: `Baris #${i + 1}: Silakan pilih SKU produk.` });
        return;
      }
      if (Number(row.quantity) <= 0) {
        setFeedbackMsg({ type: 'error', text: `Baris #${i + 1} (${row.sku}): Kuantitas pindah harus lebih dari 0.` });
        return;
      }
      const invItem = items.find(itm => itm.sku === row.sku);
      if (!invItem) {
        setFeedbackMsg({ type: 'error', text: `Baris #${i + 1}: SKU ${row.sku} tidak ditemukan dalam database.` });
        return;
      }
      if (movementType !== 'MOVE_IN' && invItem.stock < Number(row.quantity)) {
        setFeedbackMsg({
          type: 'error',
          text: `Stok ${invItem.name} (${invItem.sku}) tidak mencukupi! Tersedia: ${invItem.stock} ${invItem.unit}, Diminta: ${row.quantity} ${invItem.unit}.`
        });
        return;
      }
      if (movementType === 'INTERNAL_TRANSFER' && row.fromLocation === row.toLocation) {
        setFeedbackMsg({
          type: 'error',
          text: `Baris #${i + 1} (${row.sku}): Locator Asal dan Locator Tujuan tidak boleh sama (${row.fromLocation}).`
        });
        return;
      }
    }

    setIsProcessing(true);
    try {
      const finalReason = movementReason === 'Lainnya (Tuliskan Kustom)' ? (customReason.trim() || 'Pemindahan Kustom') : movementReason;

      const res = await recordBatchMovement({
        referenceNumber: referenceNumber.trim(),
        subType: movementType,
        movementReason: finalReason,
        notes: notes.trim(),
        items: itemRows.map(row => ({
          sku: row.sku,
          quantity: Number(row.quantity),
          fromLocation: row.fromLocation.trim(),
          toLocation: row.toLocation.trim(),
          batchLot: row.batchLot?.trim() || '',
          notes: row.notes?.trim() || ''
        }))
      });

      if (!res.success) {
        throw new Error(res.message);
      }

      setFeedbackMsg({
        type: 'success',
        text: `Transaksi Movement No. ${referenceNumber} (${movementTypeConfig[movementType].label}) berhasil dicatat & data locator telah diperbarui!`
      });

      if (res.transaction) {
        setPrintedTransaction(res.transaction);
      }

      // Reset form state
      handleGenerateNewRef(movementType);
      setNotes('');
      setCustomReason('');
      setItemRows([
        {
          sku: defaultItem?.sku || '',
          quantity: 1,
          fromLocation: defaultItem?.location?.fullCode || 'GDG01-RAK01-L01-LV1-P01',
          toLocation: defaultToLoc,
          batchLot: defaultItem?.batchLot || '',
          notes: ''
        }
      ]);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Terjadi kendala saat memproses pergerakan stok.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered transactions for History Tab
  const movementTransactions = transactions.filter(t => t.type === 'MOVEMENT' || t.type === 'TRANSFER');
  const filteredHistory = movementTransactions.filter(tx => {
    const matchesSearch =
      tx.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.fromLocation && tx.fromLocation.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (tx.toLocation && tx.toLocation.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (tx.operatorName && tx.operatorName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (tx.notes && tx.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = filterType === 'ALL' || tx.subType === filterType;
    return matchesSearch && matchesType;
  });

  // KPI calculations
  const totalMovementCount = movementTransactions.length;
  const moveOutCount = movementTransactions.filter(t => t.subType === 'MOVE_OUT').length;
  const moveInCount = movementTransactions.filter(t => t.subType === 'MOVE_IN').length;
  const internalCount = movementTransactions.filter(t => t.subType === 'INTERNAL_TRANSFER' || !t.subType).length;

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#14161B] p-6 rounded-xl border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Manajemen Movement (Pemindahan Antar Locator)
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full">
                  Multi-SKU WMS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pencatatan pergerakan mutasi internal barang antar rak/locator gudang dengan nomor transaksi terotomasi
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 bg-[#0A0B0E] p-1 rounded-lg border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2 rounded-md text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'form'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Form Movement Baru
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-md text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Riwayat Movement ({totalMovementCount})
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Total Movement</div>
            <div className="text-xl font-bold text-white tracking-tight">{totalMovementCount} Dokumen</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Transfer Antar Rak</div>
            <div className="text-xl font-bold text-white tracking-tight">{internalCount} Transaksi</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Move Out (Keluar Rak)</div>
            <div className="text-xl font-bold text-white tracking-tight">{moveOutCount} Sesi</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-400">Move In (Putaway)</div>
            <div className="text-xl font-bold text-white tracking-tight">{moveInCount} Sesi</div>
          </div>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          )}
          <div className="text-xs font-medium leading-relaxed flex-1">{feedbackMsg.text}</div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-slate-400 hover:text-white p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: FORM TRANSAKSI MOVEMENT BARU */}
      {activeTab === 'form' && (
        <form onSubmit={handleSubmitMovement} className="space-y-6">
          {/* Movement Type Selector */}
          <div className="p-5 bg-[#14161B] rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                1. Pilih Jenis Operasi Movement
              </label>
              <span className="text-[11px] text-slate-400">Pilih skema mutasi yang sesuai</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(['INTERNAL_TRANSFER', 'MOVE_OUT', 'MOVE_IN'] as MovementSubType[]).map(typeKey => {
                const conf = movementTypeConfig[typeKey];
                const Icon = conf.icon;
                const isSelected = movementType === typeKey;

                return (
                  <button
                    key={typeKey}
                    type="button"
                    onClick={() => handleTypeChange(typeKey)}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? conf.activeClass + ' shadow-md'
                        : 'bg-[#0A0B0E] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-white/10 text-white' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      {isSelected && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                          Dipilih
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">{conf.label}</div>
                      <div className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{conf.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Header Data Transaksi */}
          <div className="p-5 bg-[#14161B] rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                2. Informasi Header Dokumen Movement
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Petugas PIC:</span>
                <span className="text-xs font-semibold text-white bg-[#0A0B0E] px-2.5 py-1 rounded border border-slate-800 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                  {currentUser.name} ({currentUser.roleTitle})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* No. Transaksi (Auto Generate) */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  No. Transaksi Movement (Auto Generated) <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={referenceNumber}
                    onChange={e => setReferenceNumber(e.target.value)}
                    className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-500"
                    placeholder="MOV-2026-XXXXXX"
                  />
                  <button
                    type="button"
                    onClick={() => handleGenerateNewRef(movementType)}
                    title="Generate Ulang Nomor Dokumen"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tanggal & Jam Transaksi */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Tanggal & Waktu Transaksi
                </label>
                <input
                  type="datetime-local"
                  value={transactionDate}
                  onChange={e => setTransactionDate(e.target.value)}
                  className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Alasan Pemindahan */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                  Alasan Pemindahan (Movement Reason) <span className="text-rose-400">*</span>
                </label>
                <select
                  value={movementReason}
                  onChange={e => setMovementReason(e.target.value)}
                  className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {reasonOptions.map(r => (
                    <option key={r} value={r} className="bg-[#14161B] text-white">
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Reason Input if 'Lainnya' selected */}
            {movementReason === 'Lainnya (Tuliskan Kustom)' && (
              <div>
                <label className="block text-[11px] font-semibold text-amber-400 mb-1">
                  Keterangan Alasan Pemindahan Khusus:
                </label>
                <input
                  type="text"
                  required
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  placeholder="Misal: Perbaikan rak kolom 4 lorong B karena benturan forklift..."
                  className="w-full bg-[#0A0B0E] border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* Catatan Tambahan */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                Catatan Instruksi / Referensi Surat Perintah (Opsional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Misal: Prioritas tinggi, instruksi relokasi dari Supervisor Shift Pagi..."
                className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Multi-SKU Items Table */}
          <div className="p-5 bg-[#14161B] rounded-xl border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-cyan-400" />
                  3. Daftar Barang SKU yang Dipindahkan (Multi-SKU Item Table)
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tentukan SKU barang, kuantitas unit, locator asal (From), dan locator tujuan (To)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#0A0B0E] hover:bg-slate-800 text-cyan-400 border border-cyan-500/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  Scan Barcode
                </button>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Baris SKU
                </button>
              </div>
            </div>

            {/* Item Rows Container */}
            <div className="space-y-3">
              {itemRows.map((row, idx) => {
                const selectedItem = items.find(i => i.sku === row.sku);
                const currentStock = selectedItem?.stock || 0;
                const unitName = selectedItem?.unit || 'Pcs';
                const cbmPerUnit = selectedItem?.cbmPerUnit || 0;
                const rowTotalCbm = (cbmPerUnit * (Number(row.quantity) || 0)).toFixed(3);

                return (
                  <div
                    key={idx}
                    className="p-4 bg-[#0A0B0E] rounded-xl border border-slate-800 hover:border-slate-700 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[11px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-white">
                          Baris Item #{idx + 1}
                        </span>
                        {selectedItem && (
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                            Stok Saat Ini: <strong className="text-cyan-400">{currentStock} {unitName}</strong>
                          </span>
                        )}
                      </div>

                      {itemRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 p-1.5 rounded transition-colors cursor-pointer text-xs flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      {/* SKU Selection */}
                      <div className="md:col-span-4">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">
                          Pilih Produk SKU <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={row.sku}
                          onChange={e => handleRowChange(idx, 'sku', e.target.value)}
                          className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                        >
                          {items.map(itm => (
                            <option key={itm.sku} value={itm.sku} className="bg-[#14161B] text-white">
                              {itm.sku} - {itm.name} ({itm.stock} {itm.unit})
                            </option>
                          ))}
                        </select>
                        {selectedItem && (
                          <div className="text-[10px] text-slate-500 mt-1 truncate">
                            Brand: {selectedItem.brand} | Kat: {selectedItem.category} | CBM: {cbmPerUnit} m³
                          </div>
                        )}
                      </div>

                      {/* Locator Asal (From) */}
                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">
                          Locator Asal (From) <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={row.fromLocation}
                            onChange={e => handleRowChange(idx, 'fromLocation', e.target.value)}
                            placeholder="e.g. GDG01-RAK01-L01-LV1-P01"
                            className="w-full bg-[#14161B] border border-slate-800 rounded-lg pl-7 pr-2.5 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-cyan-500"
                          />
                          <MapPin className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 top-2.5 pointer-events-none" />
                        </div>
                      </div>

                      {/* Locator Tujuan (To) */}
                      <div className="md:col-span-3">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">
                          Locator Tujuan (To) <span className="text-rose-400">*</span>
                        </label>
                        {movementType === 'MOVE_OUT' ? (
                          <input
                            type="text"
                            value={row.toLocation}
                            onChange={e => handleRowChange(idx, 'toLocation', e.target.value)}
                            placeholder="Staging Area Transit"
                            className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-2.5 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-cyan-500"
                          />
                        ) : (
                          <select
                            value={row.toLocation}
                            onChange={e => handleRowChange(idx, 'toLocation', e.target.value)}
                            className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-2.5 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                          >
                            {locators.map(loc => (
                              <option key={loc.id || loc.fullCode} value={loc.fullCode} className="bg-[#14161B] text-white">
                                {loc.fullCode} ({loc.storageType} - {loc.status})
                              </option>
                            ))}
                            <option value="Staging Area Transit / Buffering" className="bg-[#14161B] text-slate-400">
                              -- Staging Area Transit / Buffering --
                            </option>
                          </select>
                        )}
                      </div>

                      {/* Quantity Input */}
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">
                          Qty Pindah ({unitName}) <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={movementType === 'MOVE_IN' ? 99999 : currentStock}
                          value={row.quantity}
                          onChange={e => handleRowChange(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-2.5 py-2 text-xs font-bold text-cyan-300 focus:outline-none focus:border-cyan-500 text-center"
                        />
                        <div className="text-[10px] text-slate-500 mt-1 text-center">
                          Total: ~{rowTotalCbm} m³
                        </div>
                      </div>
                    </div>

                    {/* Batch Lot & Row Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-800/60">
                      <div>
                        <input
                          type="text"
                          value={row.batchLot || ''}
                          onChange={e => handleRowChange(idx, 'batchLot', e.target.value)}
                          placeholder="Nomor Batch / Lot (e.g. LOT-2026-08A)"
                          className="w-full bg-[#14161B] border border-slate-800 rounded px-2.5 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={row.notes || ''}
                          onChange={e => handleRowChange(idx, 'notes', e.target.value)}
                          placeholder="Keterangan spesifik baris (opsional)..."
                          className="w-full bg-[#14161B] border border-slate-800 rounded px-2.5 py-1.5 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Action & Summary Footer */}
          <div className="p-5 bg-[#14161B] rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Baris SKU</div>
                <div className="text-base font-bold text-white">{itemRows.length} SKU</div>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Qty Pindah</div>
                <div className="text-base font-bold text-cyan-400">{totalQuantity} Unit</div>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Estimasi Kubikasi</div>
                <div className="text-base font-bold text-slate-300">{totalCbm.toFixed(3)} m³</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setItemRows([
                    {
                      sku: defaultItem?.sku || '',
                      quantity: 1,
                      fromLocation: defaultItem?.location?.fullCode || 'GDG01-RAK01-L01-LV1-P01',
                      toLocation: defaultToLoc,
                      batchLot: defaultItem?.batchLot || '',
                      notes: ''
                    }
                  ]);
                  setFeedbackMsg(null);
                }}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Reset Form
              </button>

              <button
                type="submit"
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Memproses Pemindahan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Eksekusi & Simpan Movement
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: RIWAYAT TRANSAKSI MOVEMENT (HISTORY) */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="p-4 bg-[#14161B] rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari No. Dokumen (MOV-...), SKU, Nama Barang, Locator Asal/Tujuan, atau PIC..."
                className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Filter Tipe:</span>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="ALL">Semua Jenis Movement</option>
                <option value="INTERNAL_TRANSFER">Transfer Antar Rak</option>
                <option value="MOVE_OUT">Move Out (Keluar Rak)</option>
                <option value="MOVE_IN">Move In (Putaway)</option>
              </select>
            </div>
          </div>

          {/* History Records Table */}
          <div className="bg-[#14161B] rounded-xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#0A0B0E] text-slate-400 border-b border-slate-800 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-3 px-4">No. Transaksi</th>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Jenis Movement</th>
                    <th className="py-3 px-4">Rincian SKU & Barang</th>
                    <th className="py-3 px-4 text-center">Total Qty</th>
                    <th className="py-3 px-4">Rute Locator (From ➔ To)</th>
                    <th className="py-3 px-4">Alasan & PIC</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300 font-sans">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-500">
                        <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-50" />
                        <div className="text-sm font-semibold text-slate-400">Belum ada riwayat transaksi movement.</div>
                        <div className="text-xs text-slate-600 mt-1">
                          Lakukan pemindahan barang pertama Anda melalui form di atas.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((tx) => {
                      const isMulti = tx.itemsList && tx.itemsList.length > 1;
                      const subTypeKey = (tx.subType as MovementSubType) || 'INTERNAL_TRANSFER';
                      const badgeConf = movementTypeConfig[subTypeKey] || movementTypeConfig.INTERNAL_TRANSFER;

                      return (
                        <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                          {/* Reference Number */}
                          <td className="py-3.5 px-4 font-mono font-bold text-cyan-400 whitespace-nowrap">
                            {tx.referenceNumber}
                          </td>

                          {/* Timestamp */}
                          <td className="py-3.5 px-4 text-[11px] text-slate-400 whitespace-nowrap">
                            {tx.timestamp}
                          </td>

                          {/* Sub Type Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badgeConf.badgeClass}`}>
                              {badgeConf.label.split(' ')[0]} {badgeConf.label.split(' ')[1]}
                            </span>
                          </td>

                          {/* SKU & Products */}
                          <td className="py-3.5 px-4">
                            {isMulti ? (
                              <div>
                                <div className="font-semibold text-white">
                                  {tx.itemsList?.length} Macam SKU Produk
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">
                                  {tx.itemsList?.map(i => i.sku).join(', ')}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-semibold text-white truncate max-w-xs">
                                  {tx.productName}
                                </div>
                                <div className="text-[11px] text-cyan-400 font-mono">
                                  {tx.sku}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Total Quantity */}
                          <td className="py-3.5 px-4 text-center font-bold text-white whitespace-nowrap">
                            {tx.quantity} <span className="text-[10px] text-slate-500 font-normal">{tx.unit}</span>
                          </td>

                          {/* Location Route */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 text-xs font-mono">
                              <span className="text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 truncate max-w-[120px]">
                                {tx.fromLocation || 'Origin'}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 truncate max-w-[120px]">
                                {tx.toLocation || 'Destination'}
                              </span>
                            </div>
                          </td>

                          {/* Reason & Operator */}
                          <td className="py-3.5 px-4">
                            <div className="text-xs text-white truncate max-w-xs">
                              {tx.movementReason || tx.notes || 'Relokasi Gudang'}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              PIC: {tx.operatorName}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedTxDetail(tx)}
                                title="Lihat Rincian Multi-SKU"
                                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setPrintedTransaction(tx)}
                                title="Cetak Surat Perintah Movement"
                                className="p-1.5 rounded bg-cyan-600/20 hover:bg-cyan-600 text-cyan-400 hover:text-white transition-colors cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL FOR MULTI-SKU MOVEMENT */}
      {selectedTxDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14161B] border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#0A0B0E]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-600/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Rincian Transaksi Movement #{selectedTxDetail.referenceNumber}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedTxDetail.timestamp} | PIC: {selectedTxDetail.operatorName} ({selectedTxDetail.operatorRole})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTxDetail(null)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[#0A0B0E] rounded-lg border border-slate-800">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold">Tipe Movement</div>
                  <div className="text-xs font-bold text-cyan-400 mt-0.5">{selectedTxDetail.subType || 'TRANSFER'}</div>
                </div>
                <div className="p-3 bg-[#0A0B0E] rounded-lg border border-slate-800">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold">Total Qty</div>
                  <div className="text-xs font-bold text-white mt-0.5">{selectedTxDetail.quantity} Unit</div>
                </div>
                <div className="p-3 bg-[#0A0B0E] rounded-lg border border-slate-800">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold">Status</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">COMPLETED</div>
                </div>
                <div className="p-3 bg-[#0A0B0E] rounded-lg border border-slate-800">
                  <div className="text-[10px] uppercase text-slate-500 font-semibold">Alasan</div>
                  <div className="text-xs font-bold text-slate-300 mt-0.5 truncate">{selectedTxDetail.movementReason || selectedTxDetail.notes || '-'}</div>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <div className="p-3 bg-[#0A0B0E] border-b border-slate-800 text-xs font-bold text-white flex items-center justify-between">
                  <span>Daftar Multi-SKU Item Terpindah</span>
                  <span className="text-[11px] text-slate-400">
                    {(selectedTxDetail.itemsList?.length || 1)} Item Terdata
                  </span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0D0E12] text-slate-400 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Kode SKU</th>
                      <th className="py-2.5 px-3">Nama Produk</th>
                      <th className="py-2.5 px-3">Locator Asal</th>
                      <th className="py-2.5 px-3">Locator Tujuan</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300 font-sans">
                    {selectedTxDetail.itemsList && selectedTxDetail.itemsList.length > 0 ? (
                      selectedTxDetail.itemsList.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 text-slate-500">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono text-cyan-400 font-semibold">{item.sku}</td>
                          <td className="py-2.5 px-3 text-white">{item.productName}</td>
                          <td className="py-2.5 px-3 font-mono text-amber-300 text-[11px]">{item.fromLocationCode || selectedTxDetail.fromLocation}</td>
                          <td className="py-2.5 px-3 font-mono text-emerald-300 text-[11px]">{item.toLocationCode || selectedTxDetail.toLocation}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-white">{item.quantity} {item.unit}</td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">{item.notes || '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-2.5 px-3 text-slate-500">1</td>
                        <td className="py-2.5 px-3 font-mono text-cyan-400 font-semibold">{selectedTxDetail.sku}</td>
                        <td className="py-2.5 px-3 text-white">{selectedTxDetail.productName}</td>
                        <td className="py-2.5 px-3 font-mono text-amber-300 text-[11px]">{selectedTxDetail.fromLocation}</td>
                        <td className="py-2.5 px-3 font-mono text-emerald-300 text-[11px]">{selectedTxDetail.toLocation}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-white">{selectedTxDetail.quantity} {selectedTxDetail.unit}</td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">{selectedTxDetail.notes || '-'}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-[#0A0B0E] flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedTxDetail(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  setPrintedTransaction(selectedTxDetail);
                  setSelectedTxDetail(null);
                }}
                className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Cetak Bukti Movement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE TRANSFER ORDER SLIP (BUKTI SURAT JALAN MOVEMENT) */}
      {printedTransaction && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl print:m-0 print:p-0 print:border-none print:shadow-none">
            {/* Modal Controls (Hidden in Print) */}
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-cyan-600" />
                <span className="text-sm font-bold text-slate-800">
                  Pratinjau Surat Perintah Movement (Bukti Pindah Rak)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center gap-2 shadow transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Cetak / Print Dokumen
                </button>
                <button
                  onClick={() => setPrintedTransaction(null)}
                  className="p-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Document Paper */}
            <div className="p-8 overflow-y-auto space-y-6 bg-white text-slate-900 font-sans">
              {/* Document Header */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                      W
                    </div>
                    <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                      GUDANG PINTAR WMS
                    </h2>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Integrated Smart Warehouse Management System
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Kawasan Industri Pergudangan Terpadu Blok A-9
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-base font-black text-slate-900 tracking-wider">
                    SURAT PERINTAH MOVEMENT
                  </div>
                  <div className="text-xs font-mono font-bold text-cyan-700 mt-0.5">
                    NO: {printedTransaction.referenceNumber}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-1">
                    Tanggal: {printedTransaction.timestamp}
                  </div>
                  <div className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">
                    Tipe: {printedTransaction.subType || 'TRANSFER RAK'}
                  </div>
                </div>
              </div>

              {/* Transaction Metadata Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <div className="text-slate-500 font-semibold text-[10px] uppercase">Alasan Pemindahan:</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {printedTransaction.movementReason || printedTransaction.notes || 'Optimasi & Penataan Kapasitas Rak'}
                  </div>
                  {printedTransaction.notes && (
                    <div className="text-[11px] text-slate-600 mt-1">Memo: {printedTransaction.notes}</div>
                  )}
                </div>
                <div>
                  <div className="text-slate-500 font-semibold text-[10px] uppercase">Operator Pelaksana:</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {printedTransaction.operatorName}
                  </div>
                  <div className="text-[11px] text-slate-600">Jabatan: {printedTransaction.operatorRole}</div>
                </div>
              </div>

              {/* Multi-SKU Items Table */}
              <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-300">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-8">No</th>
                      <th className="py-2.5 px-3">Kode SKU</th>
                      <th className="py-2.5 px-3">Deskripsi Barang</th>
                      <th className="py-2.5 px-3">Locator Asal</th>
                      <th className="py-2.5 px-3">Locator Tujuan</th>
                      <th className="py-2.5 px-3 text-center">Batch/Lot</th>
                      <th className="py-2.5 px-3 text-right">Qty Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printedTransaction.itemsList && printedTransaction.itemsList.length > 0 ? (
                      printedTransaction.itemsList.map((itm, idx) => (
                        <tr key={idx} className="text-slate-800">
                          <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono font-bold">{itm.sku}</td>
                          <td className="py-2 px-3">{itm.productName}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-amber-700 font-semibold">
                            {itm.fromLocationCode || printedTransaction.fromLocation}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-emerald-700 font-bold">
                            {itm.toLocationCode || printedTransaction.toLocation}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-600">
                            {itm.batchLot || '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-black">
                            {itm.quantity} {itm.unit}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="text-slate-800">
                        <td className="py-2 px-3 text-center text-slate-500">1</td>
                        <td className="py-2 px-3 font-mono font-bold">{printedTransaction.sku}</td>
                        <td className="py-2 px-3">{printedTransaction.productName}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-amber-700 font-semibold">
                          {printedTransaction.fromLocation}
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-emerald-700 font-bold">
                          {printedTransaction.toLocation}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-600">
                          {printedTransaction.batchLot || '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-black">
                          {printedTransaction.quantity} {printedTransaction.unit}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-300">
                    <tr>
                      <td colSpan={6} className="py-2.5 px-3 text-right text-slate-700 uppercase text-[10px]">
                        Total Keseluruhan Barang Dipindahkan:
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-900 text-sm font-black">
                        {printedTransaction.quantity} Unit
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures & Approvals */}
              <div className="grid grid-cols-3 gap-6 pt-6 text-center text-xs">
                <div className="space-y-12">
                  <div className="text-slate-600 font-semibold text-[11px]">
                    Petugas Picking (Move Out)
                  </div>
                  <div className="border-b border-slate-400 w-3/4 mx-auto" />
                  <div className="text-slate-500 text-[10px]">( ........................................ )</div>
                </div>

                <div className="space-y-12">
                  <div className="text-slate-600 font-semibold text-[11px]">
                    Petugas Penempatan (Move In)
                  </div>
                  <div className="border-b border-slate-400 w-3/4 mx-auto" />
                  <div className="text-slate-500 text-[10px]">( ........................................ )</div>
                </div>

                <div className="space-y-12">
                  <div className="text-slate-600 font-semibold text-[11px]">
                    Supervisor / Kepala Gudang
                  </div>
                  <div className="border-b border-slate-400 w-3/4 mx-auto" />
                  <div className="text-slate-500 text-[10px]">
                    ( {currentUser.name} )
                  </div>
                </div>
              </div>

              {/* Barcode representation */}
              <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-[10px] text-slate-500">
                <div className="font-mono">
                  * {printedTransaction.referenceNumber} *
                </div>
                <div>
                  Dicetak secara otomatis oleh Sistem Gudang Pintar WMS pada {new Date().toLocaleDateString('id-ID')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
