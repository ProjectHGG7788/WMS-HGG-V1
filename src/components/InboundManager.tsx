import React, { useState } from 'react';
import {
  PackagePlus,
  Building2,
  Ship,
  GitFork,
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
  ArrowDownLeft
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { InboundSubType, StockTransaction } from '../types';
import { formatNumber } from '../utils/formatters';

interface InboundItemRow {
  sku: string;
  quantity: number;
  batchLot?: string;
  expiryDate?: string;
  targetBin?: string;
  notes?: string;
}

export const InboundManager: React.FC = () => {
  const { items, zones, transactions, recordMovement, setIsScannerOpen } = useInventory();
  const { currentUser } = useAuth();

  // Active view tab: 'form' | 'history'
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

  // Form State
  const [inboundType, setInboundType] = useState<InboundSubType>('VENDOR_LOKAL');
  const [referenceNumber, setReferenceNumber] = useState<string>(`PO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`);
  const [partnerName, setPartnerName] = useState<string>('');
  const [shippingExpedition, setShippingExpedition] = useState<string>('Armada Vendor');
  const [driverName, setDriverName] = useState<string>('');
  const [vehiclePlate, setVehiclePlate] = useState<string>('');
  const [containerNumber, setContainerNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Items to receive
  const [itemRows, setItemRows] = useState<InboundItemRow[]>([
    {
      sku: items[0]?.sku || '',
      quantity: 50,
      batchLot: `LOT-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 90)}A`,
      expiryDate: '',
      targetBin: items[0]?.location.fullCode || 'A-01-01-L1-A1',
      notes: ''
    }
  ]);

  // Loading & feedback
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Print Modal
  const [printedTransaction, setPrintedTransaction] = useState<StockTransaction | null>(null);

  // History Filters
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const typeConfig: Record<InboundSubType, { label: string; icon: any; color: string; desc: string; placeholderPartner: string; badgeClass: string }> = {
    VENDOR_LOKAL: {
      label: 'Penerimaan Vendor Lokal',
      icon: Building2,
      color: 'emerald',
      desc: 'Penerimaan barang pasokan dari supplier / pabrik manufaktur dalam negeri dengan dokumen PO & Faktur.',
      placeholderPartner: 'Nama Supplier / Vendor Lokal (PT/CV)',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    },
    IMPORT: {
      label: 'Penerimaan Import',
      icon: Ship,
      color: 'blue',
      desc: 'Penerimaan kargo impor luar negeri (kontainer/air freight) lengkap dengan dokumen PIB, Bill of Lading (BL), dan Bea Cukai.',
      placeholderPartner: 'Nama Pabrik / Supplier Luar Negeri & Negara Asal',
      badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    },
    AFILIASI: {
      label: 'Penerimaan Afiliasi & Cabang',
      icon: GitFork,
      color: 'amber',
      desc: 'Penerimaan transfer stok masuk dari anak perusahaan, holding, atau gudang cabang regional.',
      placeholderPartner: 'Nama Gudang Cabang / Unit Usaha Afiliasi Asal',
      badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    }
  };

  const handleAddItemRow = () => {
    const defaultItem = items[0];
    setItemRows([
      ...itemRows,
      {
        sku: defaultItem?.sku || '',
        quantity: 20,
        batchLot: `LOT-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 90)}A`,
        expiryDate: '',
        targetBin: defaultItem?.location.fullCode || 'A-01-01-L1-A1',
        notes: ''
      }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (itemRows.length === 1) return;
    setItemRows(itemRows.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof InboundItemRow, value: any) => {
    const updated = [...itemRows];
    if (field === 'sku') {
      const itm = items.find(i => i.sku === value);
      updated[index] = {
        ...updated[index],
        sku: value,
        targetBin: itm?.location.fullCode || updated[index].targetBin
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setItemRows(updated);
  };

  const totalQuantity = itemRows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);

  const handleSubmitInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    if (!partnerName.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Mohon lengkapi nama Vendor / Pemasok / Cabang Asal.' });
      return;
    }

    if (itemRows.length === 0 || totalQuantity <= 0) {
      setFeedbackMsg({ type: 'error', text: 'Daftar barang masuk tidak boleh kosong.' });
      return;
    }

    setIsProcessing(true);
    try {
      for (const row of itemRows) {
        const invItem = items.find(i => i.sku === row.sku);
        if (!invItem) throw new Error(`SKU ${row.sku} tidak ditemukan.`);

        const res = await recordMovement({
          type: 'INBOUND',
          subType: inboundType,
          partnerName: partnerName.trim(),
          sku: row.sku,
          quantity: Number(row.quantity),
          referenceNumber: referenceNumber.trim(),
          batchLot: row.batchLot || invItem.batchLot,
          notes: `${typeConfig[inboundType].label} dari ${partnerName.trim()}.${containerNumber ? ` Kontainer: ${containerNumber}.` : ''} ${row.notes || notes}`,
          driverName: driverName.trim(),
          vehiclePlate: vehiclePlate.trim(),
          shippingExpedition: shippingExpedition.trim(),
        });

        if (!res.success) {
          throw new Error(res.message);
        }
      }

      const firstItem = items.find(i => i.sku === itemRows[0].sku)!;
      const lastRecordedTx: StockTransaction = {
        id: `TX-IN-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
        type: 'INBOUND',
        subType: inboundType,
        partnerName: partnerName.trim(),
        sku: firstItem.sku,
        productName: firstItem.name,
        quantity: totalQuantity,
        unit: firstItem.unit,
        fromLocation: 'Inbound Dock Receiving',
        toLocation: firstItem.location.fullCode,
        referenceNumber: referenceNumber.trim(),
        operatorName: currentUser.name,
        operatorRole: currentUser.roleTitle,
        notes: notes.trim(),
        status: 'COMPLETED',
        batchLot: itemRows[0].batchLot,
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
            locationCode: r.targetBin || it.location.fullCode,
            batchLot: r.batchLot
          };
        })
      };

      setFeedbackMsg({
        type: 'success',
        text: `Penerimaan Inbound (${typeConfig[inboundType].label}) Dokumen No. ${referenceNumber} berhasil disimpan. Total ${totalQuantity} unit telah ditambahkan ke stok!`
      });

      setPrintedTransaction(lastRecordedTx);

      // Reset
      setReferenceNumber(`PO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`);
      setPartnerName('');
      setDriverName('');
      setVehiclePlate('');
      setContainerNumber('');
      setNotes('');
      setItemRows([
        {
          sku: items[0]?.sku || '',
          quantity: 50,
          batchLot: `LOT-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 90)}A`,
          expiryDate: '',
          targetBin: items[0]?.location.fullCode || 'A-01-01-L1-A1',
          notes: ''
        }
      ]);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Gagal memproses transaksi inbound.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Inbound transactions list
  const inboundTransactions = transactions.filter(t => t.type === 'INBOUND');
  const filteredTransactions = inboundTransactions.filter(t => {
    const matchType = filterType === 'ALL' || t.subType === filterType;
    const matchSearch = searchQuery === '' ||
      t.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.partnerName && t.partnerName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchType && matchSearch;
  });

  const totalInboundUnits = inboundTransactions.reduce((acc, t) => acc + t.quantity, 0);
  const localCount = inboundTransactions.filter(t => t.subType === 'VENDOR_LOKAL').length;
  const importCount = inboundTransactions.filter(t => t.subType === 'IMPORT').length;
  const affiliateCount = inboundTransactions.filter(t => t.subType === 'AFILIASI').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-xl bg-[#14161B] border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              OPERASI PENERIMAAN BARANG
            </span>
          </div>
          <h1 className="text-xl font-bold text-white mt-1.5 flex items-center gap-2.5">
            <ArrowDownLeft className="w-6 h-6 text-emerald-400" />
            Manajemen Inbound Gudang
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Modul penerimaan barang masuk dari Vendor Lokal (Supplier Pabrikan), Import (Kontainer & Bea Cukai), serta Transfer Antar-Cabang Afiliasi dengan panduan penempatan rak (Putaway).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#0A0B0E] p-1 rounded-lg border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveTab('form')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'form'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PackagePlus className="w-4 h-4" /> Terima Barang Masuk
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" /> Riwayat Inbound ({inboundTransactions.length})
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Total Unit Masuk</div>
          <div className="text-xl font-bold text-white mt-1 font-mono">{formatNumber(totalInboundUnits)} <span className="text-xs font-normal text-slate-400">Unit</span></div>
          <div className="text-[10px] text-emerald-400 mt-1">Akumulasi seluruh putaway</div>
        </div>
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Penerimaan Vendor Lokal</div>
          <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">{formatNumber(localCount)} <span className="text-xs font-normal text-slate-400">Trx</span></div>
          <div className="text-[10px] text-slate-400 mt-1">Supplier produsen domestik</div>
        </div>
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Penerimaan Import</div>
          <div className="text-xl font-bold text-blue-400 mt-1 font-mono">{formatNumber(importCount)} <span className="text-xs font-normal text-slate-400">Trx</span></div>
          <div className="text-[10px] text-slate-400 mt-1">Kargo internasional & PIB</div>
        </div>
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Penerimaan Afiliasi</div>
          <div className="text-xl font-bold text-amber-400 mt-1 font-mono">{affiliateCount} <span className="text-xs font-normal text-slate-400">Trx</span></div>
          <div className="text-[10px] text-slate-400 mt-1">Transfer stok antar cabang</div>
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

      {/* View: Inbound Form */}
      {activeTab === 'form' && (
        <form onSubmit={handleSubmitInbound} className="space-y-6">
          {/* Step 1: Inbound Source Category */}
          <div className="p-6 rounded-xl bg-[#14161B] border border-slate-800 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">1</span>
                Pilih Sumber Transaksi Penerimaan (Inbound Source)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Klasifikasikan asal muasal barang yang tiba di dermaga penerimaan gudang
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(Object.keys(typeConfig) as InboundSubType[]).map((typeKey) => {
                const conf = typeConfig[typeKey];
                const Icon = conf.icon;
                const isSelected = inboundType === typeKey;

                return (
                  <button
                    key={typeKey}
                    type="button"
                    onClick={() => setInboundType(typeKey)}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-emerald-600/10 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500'
                        : 'bg-[#0A0B0E] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
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

          {/* Step 2: Document & Vendor Metadata */}
          <div className="p-6 rounded-xl bg-[#14161B] border border-slate-800 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">2</span>
                Informasi Dokumen Pembelian & Pemasok
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Masukkan nomor PO, nomor PIB / BL (jika impor), atau nomor transfer cabang
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">
                  Nomor PO / Dokumen PIB / SJ Afiliasi *
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  required
                  placeholder={inboundType === 'IMPORT' ? 'PIB-2026-IMP-901' : 'PO-2026-08-112'}
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">
                  Nama Vendor / Supplier / Cabang Pengirim *
                </label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  required
                  placeholder={typeConfig[inboundType].placeholderPartner}
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">
                  Ekspedisi / Pengangkut
                </label>
                <select
                  value={shippingExpedition}
                  onChange={(e) => setShippingExpedition(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="Armada Vendor">Armada Vendor / Truk Pabrik</option>
                  <option value="Sinotrans Logistics">Sinotrans / Maersk Ocean Line (Impor)</option>
                  <option value="Dakota Cargo">Dakota Cargo</option>
                  <option value="JNE Trucking">JNE Trucking</option>
                  <option value="SiCepat Cargo">SiCepat Cargo</option>
                  <option value="Armada Internal Cabang">Armada Internal Cabang</option>
                </select>
              </div>

              {inboundType === 'IMPORT' && (
                <div className="space-y-1.5">
                  <label className="text-blue-400 font-semibold flex items-center gap-1">
                    <Ship className="w-3.5 h-3.5" /> Nomor Kontainer / No. Seal
                  </label>
                  <input
                    type="text"
                    value={containerNumber}
                    onChange={(e) => setContainerNumber(e.target.value)}
                    placeholder="Contoh: MSKU-918239-0 / SEAL-0081"
                    className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white font-mono uppercase focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">
                  Nama Supir / Pengantar
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Contoh: Ahmad Fauzi"
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white focus:border-emerald-500 focus:outline-none"
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
                  placeholder="Contoh: B 9182 TDF"
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white font-mono uppercase focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-400 font-semibold">
                  Catatan Penerimaan / Segel QC
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Kondisi kemasan fisik, nomor segel, dsb..."
                  className="w-full px-3 py-2 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Inbound Items & Putaway Bin Suggestion */}
          <div className="p-6 rounded-xl bg-[#14161B] border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">3</span>
                  Daftar Barang Masuk & Penempatan Rak (Putaway)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verifikasi SKU, jumlah kuantitas diterima, batch lot, serta slot rak tujuan
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ScanLine className="w-3.5 h-3.5" /> Scan Barcode Barang
                </button>
                <button
                  type="button"
                  onClick={handleAddItemRow}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
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
                    <th className="p-3">Pilih SKU / Barang Masuk</th>
                    <th className="p-3 w-28">Kuantitas Masuk</th>
                    <th className="p-3 w-36">Batch / Lot No.</th>
                    <th className="p-3">Rekomendasi Rak Putaway</th>
                    <th className="p-3">Catatan Baris</th>
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
                            className="w-full px-2.5 py-1.5 rounded bg-[#0A0B0E] border border-slate-800 text-white focus:border-emerald-500 focus:outline-none"
                          >
                            {items.map((itm) => (
                              <option key={itm.id} value={itm.sku}>
                                [{itm.sku}] {itm.name} — Stok Saat Ini: {formatNumber(itm.stock)} {itm.unit}
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
                            className="w-full px-2.5 py-1.5 rounded bg-[#0A0B0E] border border-slate-800 font-mono text-white focus:border-emerald-500 focus:outline-none"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={row.batchLot || ''}
                            onChange={(e) => handleRowChange(idx, 'batchLot', e.target.value)}
                            placeholder="LOT-2026-08A"
                            className="w-full px-2.5 py-1.5 rounded bg-[#0A0B0E] border border-slate-800 text-white font-mono focus:border-emerald-500 focus:outline-none text-xs"
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-emerald-300 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-emerald-400" />
                              {row.targetBin || selectedItem?.location.fullCode || 'Zona A'}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              ({selectedItem?.location.zoneName || 'Zona Gudang'})
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={row.notes || ''}
                            onChange={(e) => handleRowChange(idx, 'notes', e.target.value)}
                            placeholder="Kemasan kardus utuh..."
                            className="w-full px-2.5 py-1.5 rounded bg-[#0A0B0E] border border-slate-800 text-white focus:border-emerald-500 focus:outline-none text-xs"
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

            {/* Inbound Summary Footer */}
            <div className="p-4 rounded-lg bg-[#0A0B0E] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="text-slate-400">Total Baris Penerimaan: <strong className="text-white font-mono">{formatNumber(itemRows.length)} SKU</strong></div>
                <div className="text-slate-400">Total Kuantitas Masuk: <strong className="text-emerald-400 font-mono font-bold text-sm">+{formatNumber(totalQuantity)} Unit</strong></div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isProcessing || totalQuantity <= 0}
                  className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  {isProcessing ? (
                    'Menyimpan Inbound...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Konfirmasi Penerimaan & Cetak GRN
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* View: Inbound History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 font-semibold">Filter Sumber:</span>
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterType === 'ALL' ? 'bg-emerald-600 text-white' : 'bg-[#0A0B0E] border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Semua ({inboundTransactions.length})
              </button>
              <button
                onClick={() => setFilterType('VENDOR_LOKAL')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterType === 'VENDOR_LOKAL' ? 'bg-emerald-600 text-white' : 'bg-[#0A0B0E] border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Vendor Lokal ({localCount})
              </button>
              <button
                onClick={() => setFilterType('IMPORT')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterType === 'IMPORT' ? 'bg-blue-600 text-white' : 'bg-[#0A0B0E] border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Import ({importCount})
              </button>
              <button
                onClick={() => setFilterType('AFILIASI')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  filterType === 'AFILIASI' ? 'bg-amber-600 text-white' : 'bg-[#0A0B0E] border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                Afiliasi ({affiliateCount})
              </button>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari No. PO / SKU / Vendor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0A0B0E] border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="rounded-xl bg-[#14161B] border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-[#0A0B0E]">
                    <th className="p-3">Waktu & Ref PO/PIB</th>
                    <th className="p-3">Kategori Sumber</th>
                    <th className="p-3">Pemasok / Vendor / Cabang</th>
                    <th className="p-3">SKU & Nama Barang</th>
                    <th className="p-3 text-right">Kuantitas Masuk</th>
                    <th className="p-3">Lokasi Putaway</th>
                    <th className="p-3">Ekspedisi / Supir</th>
                    <th className="p-3 text-center">Dokumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        Tidak ada transaksi inbound yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const subtypeKey = (tx.subType || 'VENDOR_LOKAL') as InboundSubType;
                      const conf = typeConfig[subtypeKey] || typeConfig.VENDOR_LOKAL;

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
                            <div className="font-mono text-emerald-300">{tx.sku}</div>
                            <div className="text-slate-300 truncate max-w-[200px]">{tx.productName}</div>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-400">
                            +{formatNumber(tx.quantity)} <span className="text-[10px] font-normal text-slate-400">{tx.unit}</span>
                          </td>
                          <td className="p-3">
                            <span className="font-mono text-slate-400 text-[11px] px-1.5 py-0.5 rounded bg-[#0A0B0E] border border-slate-800">
                              {tx.toLocation || 'Zona A'}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="text-slate-300">{tx.shippingExpedition || 'Armada Vendor'}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{tx.driverName ? `${tx.driverName} (${tx.vehiclePlate || '-'})` : '-'}</div>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setPrintedTransaction(tx)}
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Printer className="w-3 h-3" /> Cetak GRN
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

      {/* Goods Receipt Note (GRN) Print Modal */}
      {printedTransaction && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#14161B] border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-base">Berita Acara Penerimaan Barang (Goods Receipt Note / GRN)</h3>
              </div>
              <button onClick={() => setPrintedTransaction(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-white text-slate-900 p-6 rounded-lg font-sans space-y-6 border border-slate-200">
              <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                <div>
                  <h2 className="text-base font-black tracking-wide text-emerald-900 uppercase">WMS GUDANG PINTAR NUSANTARA</h2>
                  <p className="text-[11px] text-slate-600">Dermaga Penerimaan Inbound (Receiving Dock 01)</p>
                  <p className="text-[11px] text-slate-600">Telp: (021) 8901-4455 | Email: receiving@gudangpintar.co.id</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold uppercase text-slate-500">GOODS RECEIPT NOTE (GRN)</div>
                  <div className="text-sm font-mono font-bold text-emerald-700">{printedTransaction.referenceNumber}</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{printedTransaction.timestamp}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <div className="text-slate-500 font-semibold">Pemasok / Vendor Asal:</div>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{printedTransaction.partnerName || 'Vendor Lokal'}</div>
                  <div className="text-slate-600 text-[11px] mt-0.5">Kategori: {typeConfig[(printedTransaction.subType || 'VENDOR_LOKAL') as InboundSubType]?.label}</div>
                </div>
                <div>
                  <div className="text-slate-500 font-semibold">Informasi Logistik Pengangkut:</div>
                  <div className="font-bold text-slate-900 mt-0.5">{printedTransaction.shippingExpedition || 'Armada Vendor'}</div>
                  <div className="text-slate-600 text-[11px] font-mono">Driver: {printedTransaction.driverName || '-'} | Nopol: {printedTransaction.vehiclePlate || '-'}</div>
                </div>
              </div>

              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <th className="p-2 border border-slate-300 w-8">No</th>
                    <th className="p-2 border border-slate-300">Kode SKU</th>
                    <th className="p-2 border border-slate-300">Nama Barang Diterima</th>
                    <th className="p-2 border border-slate-300">Batch / Lot</th>
                    <th className="p-2 border border-slate-300">Lokasi Putaway</th>
                    <th className="p-2 border border-slate-300 text-right">Kuantitas</th>
                    <th className="p-2 border border-slate-300 text-center">Status QC</th>
                  </tr>
                </thead>
                <tbody>
                  {printedTransaction.itemsList && printedTransaction.itemsList.length > 0 ? (
                    printedTransaction.itemsList.map((itm, i) => (
                      <tr key={i} className="border-b border-slate-200">
                        <td className="p-2 border border-slate-300 font-mono text-center">{i + 1}</td>
                        <td className="p-2 border border-slate-300 font-mono font-semibold">{itm.sku}</td>
                        <td className="p-2 border border-slate-300">{itm.productName}</td>
                        <td className="p-2 border border-slate-300 font-mono">{itm.batchLot || printedTransaction.batchLot || 'LOT-2026'}</td>
                        <td className="p-2 border border-slate-300 font-mono">{itm.locationCode || 'Zona A'}</td>
                        <td className="p-2 border border-slate-300 text-right font-mono font-bold text-emerald-700">+{formatNumber(itm.quantity)} {itm.unit}</td>
                        <td className="p-2 border border-slate-300 text-center text-[10px] font-bold text-emerald-700">QC PASSED</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-b border-slate-200">
                      <td className="p-2 border border-slate-300 font-mono text-center">1</td>
                      <td className="p-2 border border-slate-300 font-mono font-semibold">{printedTransaction.sku}</td>
                      <td className="p-2 border border-slate-300">{printedTransaction.productName}</td>
                      <td className="p-2 border border-slate-300 font-mono">{printedTransaction.batchLot || 'LOT-2026-08'}</td>
                      <td className="p-2 border border-slate-300 font-mono">{printedTransaction.toLocation || 'Zona A'}</td>
                      <td className="p-2 border border-slate-300 text-right font-mono font-bold text-emerald-700">+{formatNumber(printedTransaction.quantity)} {printedTransaction.unit}</td>
                      <td className="p-2 border border-slate-300 text-center text-[10px] font-bold text-emerald-700">QC PASSED</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="grid grid-cols-3 gap-4 pt-6 text-center text-xs">
                <div className="space-y-12">
                  <div className="text-slate-500 font-semibold">Pengantar / Driver Vendor</div>
                  <div className="border-t border-slate-400 font-bold text-slate-800 pt-1">
                    {printedTransaction.driverName || '( ................................... )'}
                  </div>
                </div>
                <div className="space-y-12">
                  <div className="text-slate-500 font-semibold">Petugas Penerima (Receiving)</div>
                  <div className="border-t border-slate-400 font-bold text-slate-800 pt-1">
                    {printedTransaction.operatorName || currentUser.name}
                  </div>
                </div>
                <div className="space-y-12">
                  <div className="text-slate-500 font-semibold">Kepala Operasional Gudang</div>
                  <div className="border-t border-slate-400 font-bold text-slate-800 pt-1">
                    Budi Santoso, S.T.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Cetak Lembar GRN
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
