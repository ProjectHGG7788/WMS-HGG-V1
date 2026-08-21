import React, { useState } from 'react';
import {
  Truck,
  PackageMinus,
  Store,
  Sparkles,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  Printer,
  Search,
  ArrowRight,
  AlertCircle,
  FileText,
  User,
  Clock,
  ScanLine,
  MapPin,
  X
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { OutboundSubType, StockTransaction } from '../types';

interface OutboundItemRow {
  sku: string;
  quantity: number;
  notes?: string;
}

export const OutboundManager: React.FC = () => {
  const { items, transactions, recordMovement, setIsScannerOpen } = useInventory();
  const { currentUser } = useAuth();

  // Tab: 'form' | 'history'
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

  // Form State
  const [outboundType, setOutboundType] = useState<OutboundSubType>('CUSTOMER_REGULER');
  const [referenceNumber, setReferenceNumber] = useState<string>(`DO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`);
  const [partnerName, setPartnerName] = useState<string>('');
  const [shippingExpedition, setShippingExpedition] = useState<string>('JNE Express');
  const [driverName, setDriverName] = useState<string>('');
  const [vehiclePlate, setVehiclePlate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Items to dispatch
  const [itemRows, setItemRows] = useState<OutboundItemRow[]>([
    { sku: items[0]?.sku || '', quantity: 1, notes: '' }
  ]);

  // Loading & Feedback
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Print Modal State
  const [printedTransaction, setPrintedTransaction] = useState<StockTransaction | null>(null);
  const [selectedTxDetail, setSelectedTxDetail] = useState<StockTransaction | null>(null);

  // History Filter
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Helper type configurations
  const typeConfig: Record<OutboundSubType, { label: string; icon: any; color: string; desc: string; placeholderPartner: string; badgeClass: string }> = {
    CUSTOMER_REGULER: {
      label: 'Order Customer Reguler',
      icon: Truck,
      color: 'indigo',
      desc: 'Pengeluaran barang untuk pemenuhan pesanan penjualan reguler customer / distributor.',
      placeholderPartner: 'Nama Customer / Toko / Perusahaan Pembeli',
      badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
    },
    KONSINYASI: {
      label: 'Pengiriman Konsinyasi',
      icon: Store,
      color: 'amber',
      desc: 'Pengeluaran barang titip jual (konsinyasi) ke gerai mitra, supermarket, atau department store.',
      placeholderPartner: 'Nama Toko Mitra / Mall / Department Store Konsinyasi',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    },
    PAMERAN: {
      label: 'Barang Pameran & Event',
      icon: Sparkles,
      color: 'purple',
      desc: 'Pengeluaran barang contoh / display / sampel demo untuk kebutuhan pameran atau event promosi.',
      placeholderPartner: 'Nama Event / Booth Pameran / Lokasi Exhibition Hall',
      badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30'
    },
    RETUR_VENDOR: {
      label: 'Retur ke Vendor',
      icon: RotateCcw,
      color: 'rose',
      desc: 'Pengeluaran pengembalian barang rusak, defect, expired, atau klaim garansi ke pihak vendor / supplier.',
      placeholderPartner: 'Nama Vendor / Pabrikan / Supplier Tujuan Retur',
      badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
    }
  };

  const handleAddItemRow = () => {
    setItemRows([...itemRows, { sku: items[0]?.sku || '', quantity: 1, notes: '' }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (itemRows.length === 1) return;
    setItemRows(itemRows.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof OutboundItemRow, value: any) => {
    const updated = [...itemRows];
    updated[index] = { ...updated[index], [field]: value };
    setItemRows(updated);
  };

  // Calculate totals
  const totalQuantity = itemRows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);

  const handleSubmitOutbound = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    if (!partnerName.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Mohon isi nama Customer / Mitra / Vendor tujuan.' });
      return;
    }

    if (itemRows.length === 0 || totalQuantity <= 0) {
      setFeedbackMsg({ type: 'error', text: 'Daftar barang pengeluaran tidak boleh kosong.' });
      return;
    }

    // Validate stocks
    for (const row of itemRows) {
      const invItem = items.find(i => i.sku === row.sku);
      if (!invItem) {
        setFeedbackMsg({ type: 'error', text: `SKU ${row.sku} tidak ditemukan dalam inventaris gudang.` });
        return;
      }
      if (invItem.stock < row.quantity) {
        setFeedbackMsg({
          type: 'error',
          text: `Stok ${invItem.name} (${invItem.sku}) tidak mencukupi! Tersedia: ${invItem.stock} ${invItem.unit}, Diminta: ${row.quantity} ${invItem.unit}.`
        });
        return;
      }
    }

    setIsProcessing(true);
    try {
      // Process items in sequence
      let lastRecordedTx: StockTransaction | null = null;

      for (const row of itemRows) {
        const invItem = items.find(i => i.sku === row.sku)!;
        const res = await recordMovement({
          type: 'OUTBOUND',
          subType: outboundType,
          partnerName: partnerName.trim(),
          sku: row.sku,
          quantity: Number(row.quantity),
          referenceNumber: referenceNumber.trim(),
          notes: `${typeConfig[outboundType].label} - ${partnerName.trim()}. ${row.notes || notes}`,
          driverName: driverName.trim(),
          vehiclePlate: vehiclePlate.trim(),
          shippingExpedition: shippingExpedition.trim(),
        });

        if (!res.success) {
          throw new Error(res.message);
        }
      }

      // Build mock print transaction object
      const firstItem = items.find(i => i.sku === itemRows[0].sku)!;
      lastRecordedTx = {
        id: `TX-OUT-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        type: 'OUTBOUND',
        subType: outboundType,
        partnerName: partnerName.trim(),
        sku: firstItem.sku,
        productName: firstItem.name,
        quantity: totalQuantity,
        unit: firstItem.unit,
        fromLocation: firstItem.location.fullCode,
        toLocation: 'Outbound Dispatch Area',
        referenceNumber: referenceNumber.trim(),
        operatorName: currentUser.name,
        operatorRole: currentUser.roleTitle,
        notes: notes.trim(),
        status: 'COMPLETED',
        driverName: driverName.trim(),
        vehiclePlate: vehiclePlate.trim(),
        shippingExpedition: shippingExpedition.trim(),
        itemsList: itemRows.map(r => {
          const it = items.find(i => i.sku === r.sku)!;
          return {
            sku: it.sku,
            productName: it.name,
            quantity: r.quantity,
            unit: it.unit,
            locationCode: it.location.fullCode
          };
        })
      };

      setFeedbackMsg({
        type: 'success',
        text: `Transaksi Outbound (${typeConfig[outboundType].label}) No. ${referenceNumber} berhasil diproses dan stok telah diperbarui!`
      });

      setPrintedTransaction(lastRecordedTx);

      // Reset form
      setReferenceNumber(`DO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`);
      setPartnerName('');
      setDriverName('');
      setVehiclePlate('');
      setNotes('');
      setItemRows([{ sku: items[0]?.sku || '', quantity: 1, notes: '' }]);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Gagal memproses transaksi outbound.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Filter outbound transactions
  const outboundTransactions = transactions.filter(t => t.type === 'OUTBOUND');
  const filteredTransactions = outboundTransactions.filter(t => {
    const matchType = filterType === 'ALL' || t.subType === filterType;
    const matchSearch = searchQuery === '' ||
      t.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.partnerName && t.partnerName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchType && matchSearch;
  });

  // KPI Metrics
  const totalOutboundUnits = outboundTransactions.reduce((acc, t) => acc + t.quantity, 0);
  const regularCount = outboundTransactions.filter(t => t.subType === 'CUSTOMER_REGULER').length;
  const consignmentCount = outboundTransactions.filter(t => t.subType === 'KONSINYASI').length;
  const exhibitionCount = outboundTransactions.filter(t => t.subType === 'PAMERAN').length;
  const vendorReturnCount = outboundTransactions.filter(t => t.subType === 'RETUR_VENDOR').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-xl bg-[#14161B] border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              OPERASI PENGELUARAN BARANG
            </span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1.5 flex items-center gap-2.5">
            <Truck className="w-6 h-6 text-indigo-400" />
            Manajemen Outbound Gudang
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Modul pemrosesan dan verifikasi keluar barang atas transaksi Order Customer Reguler, Konsinyasi (titip jual), Barang Pameran / Event, serta Retur Pengembalian ke Vendor.
          </p>
        </div>

        {/* Action switch tabs */}
        <div className="flex items-center gap-2 bg-[#0A0B0E] p-1 rounded-lg border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'form'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PackageMinus className="w-4 h-4" /> Buat Transaksi Keluar
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" /> Riwayat Outbound ({outboundTransactions.length})
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Total Unit Keluar</div>
          <div className="text-xl font-bold text-white mt-1 font-mono">{totalOutboundUnits} <span className="text-xs font-normal text-slate-400">Unit</span></div>
          <div className="text-[10px] text-indigo-400 mt-1">Akumulasi seluruh dispatch</div>
        </div>
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Order Reguler</div>
          <div className="text-xl font-bold text-indigo-400 mt-1 font-mono">{regularCount} <span className="text-xs font-normal text-slate-400">Trx</span></div>
          <div className="text-[10px] text-slate-400 mt-1">Customer / Sales B2B</div>
        </div>
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Konsinyasi</div>
          <div className="text-xl font-bold text-amber-400 mt-1 font-mono">{consignmentCount} <span className="text-xs font-normal text-slate-400">Trx</span></div>
          <div className="text-[10px] text-slate-400 mt-1">Titip jual mitra retail</div>
        </div>
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Pameran & Event</div>
          <div className="text-xl font-bold text-purple-400 mt-1 font-mono">{exhibitionCount} <span className="text-xs font-normal text-slate-400">Trx</span></div>
          <div className="text-[10px] text-slate-400 mt-1">Display & Sampel demo</div>
        </div>
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Retur Vendor</div>
          <div className="text-xl font-bold text-rose-400 mt-1 font-mono">{vendorReturnCount} <span className="text-xs font-normal text-slate-400">Trx</span></div>
          <div className="text-[10px] text-slate-400 mt-1">Pengembalian defect/expired</div>
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
            {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* View: Outbound Form */}
      {activeTab === 'form' && (
        <form onSubmit={handleSubmitOutbound} className="space-y-6">
          {/* Step 1: Select Sub-type */}
          <div className="p-6 rounded-xl bg-[#14161B] border border-slate-800 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">1</span>
                Pilih Kategori Transaksi Outbound
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Tentukan klasifikasi pengeluaran barang sesuai dengan peruntukan operasional
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(Object.keys(typeConfig) as OutboundSubType[]).map((typeKey) => {
                const conf = typeConfig[typeKey];
                const Icon = conf.icon;
                const isSelected = outboundType === typeKey;

                return (
                  <button
                    key={typeKey}
                    type="button"
                    onClick={() => setOutboundType(typeKey)}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-600/10 border-indigo-500 text-white shadow-sm ring-1 ring-indigo-500'
                        : 'bg-[#0A0B0E] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
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

          {/* Step 2: Logistics & Destination Metadata */}
          <div className="p-6 rounded-xl bg-[#14161B] border border-slate-800 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">2</span>
                Informasi Dokumen & Tujuan Pengiriman
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Lengkapi nomor dokumen referensi, pihak penerima, dan armada pengiriman
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">
                  Nomor Referensi / Surat Jalan (DO / RMA) *
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  required
                  placeholder="Contoh: DO-2026-08-991"
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">
                  Nama Penerima / Mitra / Vendor Tujuan *
                </label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  required
                  placeholder={typeConfig[outboundType].placeholderPartner}
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">
                  Jasa Ekspedisi / Jenis Armada
                </label>
                <select
                  value={shippingExpedition}
                  onChange={(e) => setShippingExpedition(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="JNE Express">JNE Express / Trucking</option>
                  <option value="SiCepat Cargo">SiCepat Cargo</option>
                  <option value="Kurir Internal Gudang">Kurir Internal Gudang</option>
                  <option value="Mobil Operasional Sales">Mobil Operasional Sales / Tim Event</option>
                  <option value="Armada Vendor / Pick Up Sendiri">Armada Vendor / Pick Up Sendiri</option>
                  <option value="Dakota Cargo">Dakota Cargo</option>
                  <option value="Indah Logistik">Indah Logistik</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">
                  Nama Pengemudi (Driver)
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Contoh: Rian Hidayat"
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">
                  Nomor Polisi Kendaraan (Plat Nomor)
                </label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="Contoh: B 9411 KLO"
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white font-mono focus:border-indigo-500 focus:outline-none uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">
                  Catatan Tambahan Transaksi
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instruksi handling, nomor PO asal, atau no segel..."
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Picking Items List */}
          <div className="p-6 rounded-xl bg-[#14161B] border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">3</span>
                  Daftar Barang yang Dikeluarkan (Picking List)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pilih SKU dari database gudang dan tentukan jumlah unit yang akan di-dispatch
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ScanLine className="w-3.5 h-3.5" /> Scan Barcode
                </button>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Baris SKU
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-[#0A0B0E]">
                    <th className="p-3 w-8">#</th>
                    <th className="p-3">Pilih Barang / SKU</th>
                    <th className="p-3">Lokasi Rak Picking</th>
                    <th className="p-3">Stok Tersedia</th>
                    <th className="p-3 w-32">Jumlah Keluar</th>
                    <th className="p-3">Catatan Baris</th>
                    <th className="p-3 w-10 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {itemRows.map((row, idx) => {
                    const selectedItem = items.find(i => i.sku === row.sku);
                    const isInsufficient = selectedItem && selectedItem.stock < row.quantity;

                    return (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="p-3 text-slate-500 font-mono">{idx + 1}</td>
                        <td className="p-3">
                          <select
                            value={row.sku}
                            onChange={(e) => handleRowChange(idx, 'sku', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded bg-[#0A0B0E] border border-slate-800 text-white focus:border-indigo-500 focus:outline-none"
                          >
                            {items.map((itm) => (
                              <option key={itm.id} value={itm.sku}>
                                [{itm.sku}] {itm.name} — Stok: {itm.stock} {itm.unit}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          {selectedItem ? (
                            <span className="font-mono text-indigo-300 px-2 py-0.5 rounded bg-indigo-950/40 border border-indigo-800/40 flex items-center gap-1 w-fit">
                              <MapPin className="w-3 h-3 text-indigo-400" />
                              {selectedItem.location.fullCode}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          {selectedItem ? (
                            <span className={`font-mono font-bold ${selectedItem.stock <= 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                              {selectedItem.stock} {selectedItem.unit}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <input
                              type="number"
                              min="1"
                              max={selectedItem?.stock || 9999}
                              value={row.quantity}
                              onChange={(e) => handleRowChange(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                              className={`w-full px-2.5 py-1.5 rounded bg-[#0A0B0E] border font-mono text-white focus:outline-none ${
                                isInsufficient ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800 focus:border-indigo-500'
                              }`}
                            />
                            {isInsufficient && (
                              <div className="text-[10px] text-rose-400 font-semibold">Melebihi stok!</div>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={row.notes || ''}
                            onChange={(e) => handleRowChange(idx, 'notes', e.target.value)}
                            placeholder="Catatan kemasan/batch..."
                            className="w-full px-2.5 py-1.5 rounded bg-[#0A0B0E] border border-slate-800 text-white focus:border-indigo-500 focus:outline-none text-xs"
                          />
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

            {/* Picking Summary Footer */}
            <div className="p-4 rounded-lg bg-[#0A0B0E] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="text-slate-400">Total Item Terpilih: <strong className="text-white font-mono">{itemRows.length} SKU</strong></div>
                <div className="text-slate-400">Total Kuantitas Dispatch: <strong className="text-indigo-400 font-mono font-bold text-sm">{totalQuantity} Unit</strong></div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isProcessing || totalQuantity <= 0}
                  className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  {isProcessing ? (
                    'Memproses Pengeluaran...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Proses & Cetak Surat Jalan
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* View: Outbound History & Verification */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters and search */}
          <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 font-semibold">Filter Kategori:</span>
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterType === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-[#0A0B0E] border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Semua ({outboundTransactions.length})
              </button>
              <button
                onClick={() => setFilterType('CUSTOMER_REGULER')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterType === 'CUSTOMER_REGULER' ? 'bg-indigo-600 text-white' : 'bg-[#0A0B0E] border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Order Reguler ({regularCount})
              </button>
              <button
                onClick={() => setFilterType('KONSINYASI')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterType === 'KONSINYASI' ? 'bg-amber-600 text-white' : 'bg-[#0A0B0E] border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Konsinyasi ({consignmentCount})
              </button>
              <button
                onClick={() => setFilterType('PAMERAN')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterType === 'PAMERAN' ? 'bg-purple-600 text-white' : 'bg-[#0A0B0E] border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Pameran ({exhibitionCount})
              </button>
              <button
                onClick={() => setFilterType('RETUR_VENDOR')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterType === 'RETUR_VENDOR' ? 'bg-rose-600 text-white' : 'bg-[#0A0B0E] border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Retur Vendor ({vendorReturnCount})
              </button>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari No. DO / SKU / Customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Transactions Table */}
          <div className="rounded-xl bg-[#14161B] border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-[#0A0B0E]">
                    <th className="p-3">Waktu & Ref DO</th>
                    <th className="p-3">Kategori Outbound</th>
                    <th className="p-3">Tujuan / Customer / Vendor</th>
                    <th className="p-3">SKU & Barang</th>
                    <th className="p-3 text-right">Kuantitas</th>
                    <th className="p-3">Lokasi Picking</th>
                    <th className="p-3">Logistik / Driver</th>
                    <th className="p-3 text-center">Aksi Dokumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        Tidak ada transaksi outbound yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const subtypeKey = (tx.subType || 'CUSTOMER_REGULER') as OutboundSubType;
                      const conf = typeConfig[subtypeKey] || typeConfig.CUSTOMER_REGULER;

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
                            <div className="font-mono text-indigo-300">{tx.sku}</div>
                            <div className="text-slate-300 truncate max-w-[200px]">{tx.productName}</div>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-white">
                            {tx.quantity} <span className="text-[10px] font-normal text-slate-400">{tx.unit}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-mono text-slate-400 text-[11px] px-1.5 py-0.5 rounded bg-[#0A0B0E] border border-slate-800">
                              {tx.fromLocation || 'Zona A'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="text-slate-300">{tx.shippingExpedition || 'Kurir Internal'}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{tx.driverName ? `${tx.driverName} (${tx.vehiclePlate || '-'})` : '-'}</div>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setPrintedTransaction(tx)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Printer className="w-3 h-3" /> Surat Jalan
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

      {/* Print Delivery Order Modal */}
      {printedTransaction && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#14161B] border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 text-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Surat Jalan Pengeluaran Barang (Delivery Order)</h3>
              </div>
              <button onClick={() => setPrintedTransaction(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Printable Area */}
            <div className="bg-white text-slate-900 p-6 rounded-lg font-sans space-y-6 border border-slate-200">
              <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                <div>
                  <h2 className="text-base font-black tracking-wide text-indigo-900 uppercase">WMS GUDANG PINTAR NUSANTARA</h2>
                  <p className="text-[11px] text-slate-600">Kawasan Pergudangan Logistik Blok B No. 12, Cikarang - Indonesia</p>
                  <p className="text-[11px] text-slate-600">Telp: (021) 8901-4455 | Email: dispatch@gudangpintar.co.id</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase text-slate-500">SURAT JALAN / DO</div>
                  <div className="text-sm font-mono font-bold text-indigo-700">{printedTransaction.referenceNumber}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{printedTransaction.timestamp}</div>
                </div>
              </div>

              {/* Logistics Metadata */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <div className="text-slate-500 font-semibold">Tujuan Pengiriman / Penerima:</div>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{printedTransaction.partnerName || 'Customer Reguler'}</div>
                  <div className="text-slate-600 text-[11px] mt-0.5">Kategori: {typeConfig[(printedTransaction.subType || 'CUSTOMER_REGULER') as OutboundSubType]?.label}</div>
                </div>
                <div>
                  <div className="text-slate-500 font-semibold">Informasi Logistik & Pengemudi:</div>
                  <div className="font-bold text-slate-900 mt-0.5">{printedTransaction.shippingExpedition || 'Kurir Internal'}</div>
                  <div className="text-slate-600 text-[11px] font-mono">Driver: {printedTransaction.driverName || '-'} | Nopol: {printedTransaction.vehiclePlate || '-'}</div>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <th className="p-2 border border-slate-300 w-8">No</th>
                    <th className="p-2 border border-slate-300">Kode SKU</th>
                    <th className="p-2 border border-slate-300">Nama Barang / Deskripsi</th>
                    <th className="p-2 border border-slate-300">Lokasi Rak</th>
                    <th className="p-2 border border-slate-300 text-right">Kuantitas</th>
                    <th className="p-2 border border-slate-300 text-center">Status Fisik</th>
                  </tr>
                </thead>
                <tbody>
                  {printedTransaction.itemsList && printedTransaction.itemsList.length > 0 ? (
                    printedTransaction.itemsList.map((itm, i) => (
                      <tr key={i} className="border-b border-slate-200">
                        <td className="p-2 border border-slate-300 font-mono text-center">{i + 1}</td>
                        <td className="p-2 border border-slate-300 font-mono font-semibold">{itm.sku}</td>
                        <td className="p-2 border border-slate-300">{itm.productName}</td>
                        <td className="p-2 border border-slate-300 font-mono">{itm.locationCode || 'Zona A'}</td>
                        <td className="p-2 border border-slate-300 text-right font-mono font-bold">{itm.quantity} {itm.unit}</td>
                        <td className="p-2 border border-slate-300 text-center text-[10px] font-bold text-emerald-700">TERVERIFIKASI</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-b border-slate-200">
                      <td className="p-2 border border-slate-300 font-mono text-center">1</td>
                      <td className="p-2 border border-slate-300 font-mono font-semibold">{printedTransaction.sku}</td>
                      <td className="p-2 border border-slate-300">{printedTransaction.productName}</td>
                      <td className="p-2 border border-slate-300 font-mono">{printedTransaction.fromLocation || 'Zona A'}</td>
                      <td className="p-2 border border-slate-300 text-right font-mono font-bold">{printedTransaction.quantity} {printedTransaction.unit}</td>
                      <td className="p-2 border border-slate-300 text-center text-[10px] font-bold text-emerald-700">TERVERIFIKASI</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-4 pt-6 text-center text-xs">
                <div className="space-y-12">
                  <div className="text-slate-500 font-semibold">Petugas Gudang / Picking</div>
                  <div className="border-t border-slate-400 font-bold text-slate-800 pt-1">
                    {printedTransaction.operatorName || currentUser.name}
                  </div>
                </div>
                <div className="space-y-12">
                  <div className="text-slate-500 font-semibold">Pengemudi / Driver</div>
                  <div className="border-t border-slate-400 font-bold text-slate-800 pt-1">
                    {printedTransaction.driverName || '( ................................... )'}
                  </div>
                </div>
                <div className="space-y-12">
                  <div className="text-slate-500 font-semibold">Diterima Oleh (Penerima)</div>
                  <div className="border-t border-slate-400 font-bold text-slate-800 pt-1">
                    ( ................................... )
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Cetak Dokumen Resmi
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
