import React, { useState } from 'react';
import {
  RotateCcw,
  UserCheck,
  Store,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Trash2,
  Printer,
  Search,
  FileText,
  Clock,
  ScanLine,
  MapPin,
  X,
  ShieldCheck,
  PackageCheck
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { ReturnSubType, ReturnQCCondition, StockTransaction } from '../types';
import { formatNumber } from '../utils/formatters';

interface ReturnItemRow {
  sku: string;
  quantity: number;
  returnReason: string;
  qcCondition: ReturnQCCondition;
  targetLocation?: string;
  notes?: string;
}

export const ReturnManager: React.FC = () => {
  const { items, transactions, recordMovement, setIsScannerOpen } = useInventory();
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

  // Form State
  const [returnType, setReturnType] = useState<ReturnSubType>('RETUR_CUSTOMER_REGULER');
  const [referenceNumber, setReferenceNumber] = useState<string>(`RMA-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`);
  const [partnerName, setPartnerName] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [shippingExpedition, setShippingExpedition] = useState<string>('Kurir Pengembalian Customer');
  const [notes, setNotes] = useState<string>('');

  // Items to receive back
  const [itemRows, setItemRows] = useState<ReturnItemRow[]>([
    {
      sku: items[0]?.sku || '',
      quantity: 1,
      returnReason: 'Klaim Garansi / Cacat Pabrik',
      qcCondition: 'GOOD_RESTOCK',
      targetLocation: items[0]?.location.fullCode || 'A-01-01-L1-A1',
      notes: ''
    }
  ]);

  // Loading & Feedback
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Print Modal
  const [printedTransaction, setPrintedTransaction] = useState<StockTransaction | null>(null);

  // History Filter
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterQC, setFilterQC] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const typeConfig: Record<ReturnSubType, { label: string; icon: any; color: string; desc: string; placeholderPartner: string; badgeClass: string }> = {
    RETUR_CUSTOMER_REGULER: {
      label: 'Retur Customer Reguler',
      icon: UserCheck,
      color: 'rose',
      desc: 'Penerimaan barang retur dari customer reguler atas klaim garansi, cacat fungsi, atau kesalahan varian kirim.',
      placeholderPartner: 'Nama Customer / Toko Pembeli Asal',
      badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
    },
    RETUR_KONSINYASI: {
      label: 'Retur Titip Jual Konsinyasi',
      icon: Store,
      color: 'amber',
      desc: 'Penerimaan penarikan sisa barang titip jual yang tidak terjual dari gerai mitra / supermarket konsinyasi.',
      placeholderPartner: 'Nama Gerai Mitra / Department Store Pengembalian',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    },
    RETUR_PAMERAN: {
      label: 'Retur Pameran & Display',
      icon: Sparkles,
      color: 'purple',
      desc: 'Penerimaan kembali barang display, unit sampel demo, dan sisa stok promosi pasca event pameran berakhir.',
      placeholderPartner: 'Nama Event / Lokasi Booth Pameran Pengirim',
      badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30'
    }
  };

  const qcConfig: Record<ReturnQCCondition, { label: string; icon: any; color: string; desc: string; targetZone: string }> = {
    GOOD_RESTOCK: {
      label: 'Layak Jual (Restock ke Rak)',
      icon: CheckCircle2,
      color: 'emerald',
      desc: 'Fisik & fungsi sempurna. Otomatis menambah stok aktif di rak utama gudang.',
      targetZone: 'Rak Penyimpanan Reguler'
    },
    REWORK: {
      label: 'Perlu Perbaikan (Rework)',
      icon: AlertTriangle,
      color: 'amber',
      desc: 'Ada cacat minor atau kemasan rusak. Ditempatkan di area karantina untuk reparasi.',
      targetZone: 'Area Karantina / Rework'
    },
    SCRAP_DAMAGED: {
      label: 'Rusak Total / Afkir (Scrap)',
      icon: XCircle,
      color: 'rose',
      desc: 'Tidak dapat diperbaiki. Ditempatkan di zona afkir untuk siap retur vendor / pemusnahan.',
      targetZone: 'Zona Afkir & Scrap'
    }
  };

  const handleAddItemRow = () => {
    const defaultItem = items[0];
    setItemRows([
      ...itemRows,
      {
        sku: defaultItem?.sku || '',
        quantity: 1,
        returnReason: 'Tarik Sisa Display / Event',
        qcCondition: 'GOOD_RESTOCK',
        targetLocation: defaultItem?.location.fullCode || 'A-01-01-L1-A1',
        notes: ''
      }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (itemRows.length === 1) return;
    setItemRows(itemRows.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof ReturnItemRow, value: any) => {
    const updated = [...itemRows];
    if (field === 'sku') {
      const itm = items.find(i => i.sku === value);
      updated[index] = {
        ...updated[index],
        sku: value,
        targetLocation: itm?.location.fullCode || updated[index].targetLocation
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setItemRows(updated);
  };

  const totalQuantity = itemRows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
  const goodRestockQuantity = itemRows
    .filter(r => r.qcCondition === 'GOOD_RESTOCK')
    .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    if (!partnerName.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Mohon isi nama Customer / Mitra / Event sumber retur.' });
      return;
    }

    if (itemRows.length === 0 || totalQuantity <= 0) {
      setFeedbackMsg({ type: 'error', text: 'Daftar barang retur tidak boleh kosong.' });
      return;
    }

    setIsProcessing(true);
    try {
      for (const row of itemRows) {
        const invItem = items.find(i => i.sku === row.sku);
        if (!invItem) throw new Error(`SKU ${row.sku} tidak ditemukan.`);

        const res = await recordMovement({
          type: 'RETURN',
          subType: returnType,
          partnerName: partnerName.trim(),
          sku: row.sku,
          quantity: Number(row.quantity),
          referenceNumber: referenceNumber.trim(),
          qcCondition: row.qcCondition,
          notes: `${typeConfig[returnType].label} - ${partnerName.trim()}. Alasan: ${row.returnReason}. QC: ${qcConfig[row.qcCondition].label}. ${row.notes || notes}`,
          driverName: driverName.trim(),
          shippingExpedition: shippingExpedition.trim(),
        });

        if (!res.success) {
          throw new Error(res.message);
        }
      }

      const firstItem = items.find(i => i.sku === itemRows[0].sku)!;
      const lastRecordedTx: StockTransaction = {
        id: `TX-RET-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        type: 'RETURN',
        subType: returnType,
        partnerName: partnerName.trim(),
        sku: firstItem.sku,
        productName: firstItem.name,
        quantity: totalQuantity,
        unit: firstItem.unit,
        fromLocation: 'Return Receiving Dock',
        toLocation: itemRows[0].qcCondition === 'GOOD_RESTOCK' ? firstItem.location.fullCode : (itemRows[0].qcCondition === 'REWORK' ? 'Karantina Rework' : 'Zona Afkir'),
        referenceNumber: referenceNumber.trim(),
        operatorName: currentUser.name,
        operatorRole: currentUser.roleTitle,
        notes: notes.trim(),
        status: 'COMPLETED',
        qcCondition: itemRows[0].qcCondition,
        driverName: driverName.trim(),
        shippingExpedition: shippingExpedition.trim(),
        itemsList: itemRows.map(r => {
          const it = items.find(i => i.sku === r.sku)!;
          return {
            sku: it.sku,
            productName: it.name,
            quantity: r.quantity,
            unit: it.unit,
            locationCode: r.qcCondition === 'GOOD_RESTOCK' ? it.location.fullCode : (r.qcCondition === 'REWORK' ? 'Area Karantina' : 'Zona Afkir'),
            qcCondition: r.qcCondition,
            returnReason: r.returnReason
          };
        })
      };

      setFeedbackMsg({
        type: 'success',
        text: `Penerimaan Retur No. ${referenceNumber} berhasil diproses! ${goodRestockQuantity} unit layak jual telah di-restock ke inventaris aktif gudang.`
      });

      setPrintedTransaction(lastRecordedTx);

      // Reset
      setReferenceNumber(`RMA-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`);
      setPartnerName('');
      setDriverName('');
      setNotes('');
      setItemRows([
        {
          sku: items[0]?.sku || '',
          quantity: 1,
          returnReason: 'Klaim Garansi / Cacat Pabrik',
          qcCondition: 'GOOD_RESTOCK',
          targetLocation: items[0]?.location.fullCode || 'A-01-01-L1-A1',
          notes: ''
        }
      ]);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Gagal memproses penerimaan barang retur.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Return Transactions
  const returnTransactions = transactions.filter(t => t.type === 'RETURN');
  const filteredTransactions = returnTransactions.filter(t => {
    const matchType = filterType === 'ALL' || t.subType === filterType;
    const matchQC = filterQC === 'ALL' || t.qcCondition === filterQC;
    const matchSearch = searchQuery === '' ||
      t.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.partnerName && t.partnerName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchType && matchQC && matchSearch;
  });

  const totalReturnUnits = returnTransactions.reduce((acc, t) => acc + t.quantity, 0);
  const customerReturnCount = returnTransactions.filter(t => t.subType === 'RETUR_CUSTOMER_REGULER').length;
  const consignmentReturnCount = returnTransactions.filter(t => t.subType === 'RETUR_KONSINYASI').length;
  const exhibitionReturnCount = returnTransactions.filter(t => t.subType === 'RETUR_PAMERAN').length;

  const goodQCCount = returnTransactions.filter(t => !t.qcCondition || t.qcCondition === 'GOOD_RESTOCK').length;
  const reworkQCCount = returnTransactions.filter(t => t.qcCondition === 'REWORK').length;
  const scrapQCCount = returnTransactions.filter(t => t.qcCondition === 'SCRAP_DAMAGED').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-xl bg-[#14161B] border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              OPERASI PENERIMAAN BARANG RETUR
            </span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1.5 flex items-center gap-2.5">
            <RotateCcw className="w-6 h-6 text-rose-400" />
            Manajemen Return & QC Gudang
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Modul penerimaan barang retur dari Customer Reguler, Konsinyasi (tarik titip jual), dan Barang Pameran dengan inspeksi Quality Control (Layak Jual / Restock, Karantina Rework, atau Afkir).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#0A0B0E] p-1 rounded-lg border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'form'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PackageCheck className="w-4 h-4" /> Form Penerimaan Retur
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" /> Riwayat Retur ({formatNumber(returnTransactions.length)})
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Total Unit Retur</div>
          <div className="text-xl font-bold text-white mt-1 font-mono">{formatNumber(totalReturnUnits)} <span className="text-xs font-normal text-slate-400">Unit</span></div>
          <div className="text-[10px] text-rose-400 mt-1">Total seluruh pengembalian</div>
        </div>
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Retur Customer</div>
          <div className="text-xl font-bold text-rose-400 mt-1 font-mono">{formatNumber(customerReturnCount)} <span className="text-xs font-normal text-slate-400">Trx</span></div>
          <div className="text-[10px] text-slate-400 mt-1">Klaim garansi / salah kirim</div>
        </div>
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Retur Konsinyasi</div>
          <div className="text-xl font-bold text-amber-400 mt-1 font-mono">{formatNumber(consignmentReturnCount)} <span className="text-xs font-normal text-slate-400">Trx</span></div>
          <div className="text-[10px] text-slate-400 mt-1">Tarik stok toko mitra</div>
        </div>
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Retur Pameran</div>
          <div className="text-xl font-bold text-purple-400 mt-1 font-mono">{formatNumber(exhibitionReturnCount)} <span className="text-xs font-normal text-slate-400">Trx</span></div>
          <div className="text-[10px] text-slate-400 mt-1">Display & sampel event</div>
        </div>
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">QC Layak Restock</div>
          <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">{formatNumber(goodQCCount)} <span className="text-xs font-normal text-slate-400">Trx</span></div>
          <div className="text-[10px] text-emerald-400/80 mt-1">Masuk rak aktif</div>
        </div>
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">QC Karantina/Afkir</div>
          <div className="text-xl font-bold text-amber-400 mt-1 font-mono">{formatNumber(reworkQCCount + scrapQCCount)} <span className="text-xs font-normal text-slate-400">Trx</span></div>
          <div className="text-[10px] text-slate-400 mt-1">{reworkQCCount} Rework / {scrapQCCount} Scrap</div>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* View: Return Form */}
      {activeTab === 'form' && (
        <form onSubmit={handleSubmitReturn} className="space-y-6">
          {/* Step 1: Return Sub-type */}
          <div className="p-6 rounded-xl bg-[#14161B] border border-slate-800 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs">1</span>
                Pilih Kategori Sumber Pengembalian (Return Type)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Tentukan asal muasal penerimaan retur barang yang masuk ke gudang
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(Object.keys(typeConfig) as ReturnSubType[]).map((typeKey) => {
                const conf = typeConfig[typeKey];
                const Icon = conf.icon;
                const isSelected = returnType === typeKey;

                return (
                  <button
                    key={typeKey}
                    type="button"
                    onClick={() => setReturnType(typeKey)}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-rose-600/10 border-rose-500 text-white shadow-sm ring-1 ring-rose-500'
                        : 'bg-[#0A0B0E] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-rose-400" />}
                      </div>
                      <div className="text-xs font-bold text-white">{conf.label}</div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {conf.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Reference Document & Sender Info */}
          <div className="p-6 rounded-xl bg-[#14161B] border border-slate-800 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs">2</span>
                Informasi Dokumen RMA & Pengirim Retur
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Lengkapi nomor RMA / Surat Jalan Retur, nama pengirim, dan ekspedisi pembawa
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">
                  Nomor Referensi Retur (No. RMA / BAPR) *
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  required
                  placeholder="Contoh: RMA-2026-08-412"
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white font-mono focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">
                  Nama Customer / Mitra / Booth Pameran *
                </label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  required
                  placeholder={typeConfig[returnType].placeholderPartner}
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">
                  Kurir Pembawa / Jasa Pengiriman
                </label>
                <select
                  value={shippingExpedition}
                  onChange={(e) => setShippingExpedition(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white focus:border-rose-500 focus:outline-none"
                >
                  <option value="Kurir Customer / Diantar Langsung">Diantar Langsung / Kurir Customer</option>
                  <option value="JNE Express">JNE Express</option>
                  <option value="SiCepat Express">SiCepat Express</option>
                  <option value="J&T Cargo">J&T Cargo</option>
                  <option value="Mobil Operasional Sales">Mobil Operasional Sales</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">
                  Nama Petugas Pengantar / Kurir
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Contoh: Doni Prasetya"
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-slate-400 font-semibold">
                  Catatan Tambahan Penerimaan Retur
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Nomor faktur penjualan asal, kronologi klaim, dsb..."
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Return Items & QC Inspection */}
          <div className="p-6 rounded-xl bg-[#14161B] border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs">3</span>
                  Daftar Barang Retur & Verifikasi Quality Control (QC)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tentukan alasan retur dan hasil penilaian inspeksi fisik & kelayakan barang
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ScanLine className="w-3.5 h-3.5" /> Scan Barcode
                </button>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Baris Retur
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-[#0A0B0E]">
                    <th className="p-3 w-8">#</th>
                    <th className="p-3">Pilih SKU yang Diretur</th>
                    <th className="p-3 w-24">Jumlah</th>
                    <th className="p-3">Alasan Retur</th>
                    <th className="p-3">Hasil Penilaian QC</th>
                    <th className="p-3">Penempatan Lokasi</th>
                    <th className="p-3 w-10 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {itemRows.map((row, idx) => {
                    const selectedItem = items.find(i => i.sku === row.sku);

                    return (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="p-3 text-slate-500 font-mono">{idx + 1}</td>
                        <td className="p-3">
                          <select
                            value={row.sku}
                            onChange={(e) => handleRowChange(idx, 'sku', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-[#0A0B0E] border border-slate-800 text-white focus:border-rose-500 focus:outline-none"
                          >
                            {items.map((itm) => (
                              <option key={itm.id} value={itm.sku}>
                                [{itm.sku}] {itm.name} (Stok Gudang: {itm.stock} {itm.unit})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => handleRowChange(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full px-2.5 py-1.5 rounded bg-[#0A0B0E] border border-slate-800 font-mono text-white focus:border-rose-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-3">
                          <select
                            value={row.returnReason}
                            onChange={(e) => handleRowChange(idx, 'returnReason', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-[#0A0B0E] border border-slate-800 text-white focus:border-rose-500 focus:outline-none"
                          >
                            <option value="Klaim Garansi / Cacat Pabrik">Klaim Garansi / Cacat Pabrik</option>
                            <option value="Salah Kirim Varian / SKU">Salah Kirim Varian / SKU</option>
                            <option value="Kemasan Rusak Saat Pengiriman">Kemasan Rusak Saat Pengiriman</option>
                            <option value="Tarik Stok Titip Jual Konsinyasi">Tarik Stok Titip Jual Konsinyasi</option>
                            <option value="Selesai Acara Pameran & Event">Selesai Acara Pameran & Event</option>
                            <option value="Pembatalan Order oleh Pembeli">Pembatalan Order oleh Pembeli</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <select
                            value={row.qcCondition}
                            onChange={(e) => handleRowChange(idx, 'qcCondition', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-[#0A0B0E] border border-slate-800 font-semibold focus:outline-none text-white"
                          >
                            <option value="GOOD_RESTOCK" className="text-emerald-400 bg-[#14161B]">
                              ✓ Layak Jual (Restock Rak Reguler)
                            </option>
                            <option value="REWORK" className="text-amber-400 bg-[#14161B]">
                              ⚠ Perlu Reparasi (Area Karantina)
                            </option>
                            <option value="SCRAP_DAMAGED" className="text-rose-400 bg-[#14161B]">
                              ✕ Rusak Total (Zona Afkir)
                            </option>
                          </select>
                        </td>
                        <td className="p-3">
                          {row.qcCondition === 'GOOD_RESTOCK' ? (
                            <span className="font-mono text-emerald-300 text-[11px] px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-1 w-fit">
                              <MapPin className="w-3 h-3 text-emerald-400" />
                              {selectedItem?.location.fullCode || 'Rak Utama'}
                            </span>
                          ) : row.qcCondition === 'REWORK' ? (
                            <span className="font-mono text-amber-300 text-[11px] px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/40 flex items-center gap-1 w-fit">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              Karantina Rework
                            </span>
                          ) : (
                            <span className="font-mono text-rose-300 text-[11px] px-2 py-0.5 rounded bg-rose-950/40 border border-rose-800/40 flex items-center gap-1 w-fit">
                              <XCircle className="w-3 h-3 text-rose-400" />
                              Zona Afkir
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(idx)}
                            disabled={itemRows.length === 1}
                            className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Return Summary Footer */}
            <div className="p-4 rounded-lg bg-[#0A0B0E] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="text-slate-400">Total Unit Diretur: <strong className="text-white font-mono">{formatNumber(totalQuantity)} Unit</strong></div>
                <div className="text-emerald-400">Restock Langsung ke Rak Aktif: <strong className="font-mono font-bold">+{formatNumber(goodRestockQuantity)} Unit</strong></div>
              </div>

              <button
                type="submit"
                disabled={isProcessing || totalQuantity <= 0}
                className="px-6 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                {isProcessing ? (
                  'Menyimpan Retur...'
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Proses Penerimaan Retur & Cetak BAPR
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* View: Return History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 font-semibold">Kategori:</span>
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterType === 'ALL' ? 'bg-rose-600 text-white' : 'bg-[#0A0B0E] border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Semua ({returnTransactions.length})
              </button>
              <button
                onClick={() => setFilterType('RETUR_CUSTOMER_REGULER')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterType === 'RETUR_CUSTOMER_REGULER' ? 'bg-rose-600 text-white' : 'bg-[#0A0B0E] border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Customer ({customerReturnCount})
              </button>
              <button
                onClick={() => setFilterType('RETUR_KONSINYASI')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterType === 'RETUR_KONSINYASI' ? 'bg-amber-600 text-white' : 'bg-[#0A0B0E] border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Konsinyasi ({consignmentReturnCount})
              </button>
              <button
                onClick={() => setFilterType('RETUR_PAMERAN')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterType === 'RETUR_PAMERAN' ? 'bg-purple-600 text-white' : 'bg-[#0A0B0E] border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Pameran ({exhibitionReturnCount})
              </button>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari No. RMA / SKU / Customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div className="rounded-xl bg-[#14161B] border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-[#0A0B0E]">
                    <th className="p-3">Waktu & Ref RMA</th>
                    <th className="p-3">Kategori Retur</th>
                    <th className="p-3">Pengirim / Customer</th>
                    <th className="p-3">SKU & Barang</th>
                    <th className="p-3 text-right">Kuantitas</th>
                    <th className="p-3">Hasil QC</th>
                    <th className="p-3">Lokasi Penempatan</th>
                    <th className="p-3 text-center">Dokumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        Tidak ada transaksi retur yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const subtypeKey = (tx.subType || 'RETUR_CUSTOMER_REGULER') as ReturnSubType;
                      const conf = typeConfig[subtypeKey] || typeConfig.RETUR_CUSTOMER_REGULER;
                      const qcKey = (tx.qcCondition || 'GOOD_RESTOCK') as ReturnQCCondition;
                      const qc = qcConfig[qcKey] || qcConfig.GOOD_RESTOCK;

                      return (
                        <tr key={tx.id} className="hover:bg-slate-800/30">
                          <td className="p-3">
                            <div className="font-mono font-bold text-white">{tx.referenceNumber}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{tx.timestamp}</div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${conf.badgeClass}`}>
                              {conf.label}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="text-slate-200 font-semibold">{tx.partnerName || '-'}</div>
                            <div className="text-[10px] text-slate-500 truncate max-w-[180px]">{tx.notes}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-mono text-rose-300">{tx.sku}</div>
                            <div className="text-slate-300 truncate max-w-[200px]">{tx.productName}</div>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-white">
                            {formatNumber(tx.quantity)} <span className="text-[10px] font-normal text-slate-400">{tx.unit}</span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              qcKey === 'GOOD_RESTOCK'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : qcKey === 'REWORK'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}>
                              {qc.label}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="font-mono text-slate-400 text-[11px] px-1.5 py-0.5 rounded bg-[#0A0B0E] border border-slate-800">
                              {tx.toLocation || 'Rak Utama'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setPrintedTransaction(tx)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Printer className="w-3 h-3" /> Cetak BAPR
                            </button>
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

      {/* Return Receipt Voucher (BAPR) Print Modal */}
      {printedTransaction && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#14161B] border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-white text-base">Berita Acara Penerimaan Barang Retur (BAPR / RMA)</h3>
              </div>
              <button onClick={() => setPrintedTransaction(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white text-slate-900 p-6 rounded-lg font-sans space-y-6 border border-slate-200">
              <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                <div>
                  <h2 className="text-base font-black tracking-wide text-rose-900 uppercase">WMS GUDANG PINTAR NUSANTARA</h2>
                  <p className="text-[11px] text-slate-600">Unit Inspeksi Kualitas & Retur Barang (QC Return Dept)</p>
                  <p className="text-[11px] text-slate-600">Telp: (021) 8901-4455 | Email: return@gudangpintar.co.id</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase text-slate-500">BERITA ACARA RETUR (BAPR)</div>
                  <div className="text-sm font-mono font-bold text-rose-700">{printedTransaction.referenceNumber}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{printedTransaction.timestamp}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <div className="text-slate-500 font-semibold">Pihak Pengirim Retur:</div>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{printedTransaction.partnerName || 'Customer / Toko Mitra'}</div>
                  <div className="text-slate-600 text-[11px] mt-0.5">Kategori: {typeConfig[(printedTransaction.subType || 'RETUR_CUSTOMER_REGULER') as ReturnSubType]?.label}</div>
                </div>
                <div>
                  <div className="text-slate-500 font-semibold">Kurir Pengantar & Ekspedisi:</div>
                  <div className="font-bold text-slate-900 mt-0.5">{printedTransaction.shippingExpedition || 'Kurir Pembawa'}</div>
                  <div className="text-slate-600 text-[11px]">Pengantar: {printedTransaction.driverName || '-'}</div>
                </div>
              </div>

              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <th className="p-2 border border-slate-300 w-8">No</th>
                    <th className="p-2 border border-slate-300">Kode SKU</th>
                    <th className="p-2 border border-slate-300">Nama Barang</th>
                    <th className="p-2 border border-slate-300 text-right">Kuantitas</th>
                    <th className="p-2 border border-slate-300">Hasil Inspeksi QC</th>
                    <th className="p-2 border border-slate-300">Alokasi Rak</th>
                  </tr>
                </thead>
                <tbody>
                  {printedTransaction.itemsList && printedTransaction.itemsList.length > 0 ? (
                    printedTransaction.itemsList.map((itm, i) => (
                      <tr key={i} className="border-b border-slate-200">
                        <td className="p-2 border border-slate-300 font-mono text-center">{i + 1}</td>
                        <td className="p-2 border border-slate-300 font-mono font-semibold">{itm.sku}</td>
                        <td className="p-2 border border-slate-300">{itm.productName}</td>
                        <td className="p-2 border border-slate-300 text-right font-mono font-bold">{formatNumber(itm.quantity)} {itm.unit}</td>
                        <td className="p-2 border border-slate-300 font-semibold">
                          {qcConfig[(itm.qcCondition || 'GOOD_RESTOCK') as ReturnQCCondition]?.label}
                        </td>
                        <td className="p-2 border border-slate-300 font-mono text-xs">{itm.locationCode || 'Rak Utama'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-b border-slate-200">
                      <td className="p-2 border border-slate-300 font-mono text-center">1</td>
                      <td className="p-2 border border-slate-300 font-mono font-semibold">{printedTransaction.sku}</td>
                      <td className="p-2 border border-slate-300">{printedTransaction.productName}</td>
                      <td className="p-2 border border-slate-300 text-right font-mono font-bold">{formatNumber(printedTransaction.quantity)} {printedTransaction.unit}</td>
                      <td className="p-2 border border-slate-300 font-semibold">
                        {qcConfig[(printedTransaction.qcCondition || 'GOOD_RESTOCK') as ReturnQCCondition]?.label}
                      </td>
                      <td className="p-2 border border-slate-300 font-mono text-xs">{printedTransaction.toLocation || 'Rak Utama'}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="grid grid-cols-3 gap-4 pt-6 text-center text-xs">
                <div className="space-y-12">
                  <div className="text-slate-500 font-semibold">Pengirim Retur</div>
                  <div className="border-t border-slate-400 font-bold text-slate-800 pt-1">
                    {printedTransaction.driverName || '( ................................... )'}
                  </div>
                </div>
                <div className="space-y-12">
                  <div className="text-slate-500 font-semibold">Staff QC Inspector</div>
                  <div className="border-t border-slate-400 font-bold text-slate-800 pt-1">
                    {printedTransaction.operatorName || currentUser.name}
                  </div>
                </div>
                <div className="space-y-12">
                  <div className="text-slate-500 font-semibold">Kepala Gudang (Mengetahui)</div>
                  <div className="border-t border-slate-400 font-bold text-slate-800 pt-1">
                    Budi Santoso, S.T.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Cetak Lembar BAPR
              </button>
              <button
                onClick={() => setPrintedTransaction(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
