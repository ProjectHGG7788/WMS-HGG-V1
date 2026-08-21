import React, { useState } from 'react';
import { 
  ArrowLeftRight, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Search, 
  Download, 
  Plus, 
  CheckCircle2, 
  X
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { StockTransaction, TransactionType } from '../types';

export const TransactionLogs: React.FC = () => {
  const { transactions, items, recordMovement } = useInventory();
  const { currentUser, hasPermission } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [isNewTxOpen, setIsNewTxOpen] = useState(false);

  // Form state
  const [txType, setTxType] = useState<TransactionType>('INBOUND');
  const [txSku, setTxSku] = useState<string>(items[0]?.sku || '');
  const [txQty, setTxQty] = useState<number>(10);
  const [txNotes, setTxNotes] = useState('');
  const [txRef, setTxRef] = useState(`PO-${Date.now().toString().slice(-6)}`);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const filteredTxs = transactions.filter((tx) => {
    const matchSearch =
      tx.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.operatorName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchType = selectedType === 'ALL' || tx.type === selectedType;
    return matchSearch && matchType;
  });

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormMsg(null);

    const res = await recordMovement({
      type: txType,
      sku: txSku,
      quantity: txQty,
      referenceNumber: txRef,
      notes: txNotes || `Input transaksi manual oleh ${currentUser.name}`,
    });

    setIsSubmitting(false);
    if (res.success) {
      setFormMsg({ type: 'success', text: res.message });
      setTxNotes('');
      setTxRef(`REF-${Date.now().toString().slice(-6)}`);
      setTimeout(() => {
        setIsNewTxOpen(false);
        setFormMsg(null);
      }, 1500);
    } else {
      setFormMsg({ type: 'error', text: res.message });
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID Transaksi,Tipe,SKU,Nama Produk,Jumlah,Satuan,Lokasi Asal,Lokasi Tujuan,Operator,No Referensi,Waktu,Catatan'];
    const rows = filteredTxs.map((t) =>
      `"${t.id}","${t.type}","${t.sku}","${t.productName}",${t.quantity},"${t.unit}","${t.fromLocation || '-'}","${t.toLocation || '-'}","${t.operatorName}","${t.referenceNumber}","${t.timestamp}","${t.notes || ''}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `WMS_Pergerakan_Barang_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-xl bg-[#14161B] border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold text-white">
                Log Pergerakan Barang
              </h2>
              <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] uppercase tracking-wider font-bold text-slate-400">
                {filteredTxs.length} Transaksi
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Audit trail seluruh transaksi penerimaan barang masuk, pengeluaran pesanan, dan relokasi rak
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-lg bg-[#0A0B0E] hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>

          <button
            onClick={() => setIsNewTxOpen(true)}
            disabled={!hasPermission('canInbound') && !hasPermission('canOutbound')}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Input Transaksi</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari Ref PO/DO, SKU, Produk, atau Operator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Semua Jenis Transaksi</option>
            <option value="INBOUND">Barang Masuk (Inbound)</option>
            <option value="OUTBOUND">Barang Keluar (Outbound)</option>
            <option value="MOVEMENT">Movement (Pindah Antar Rak)</option>
            <option value="RETURN">Retur Barang (Return QC)</option>
            <option value="TRANSFER">Mutasi / Relokasi Rak</option>
            <option value="ADJUSTMENT">Penyesuaian Opname</option>
          </select>
        </div>
      </div>

      {/* Transactions List Table */}
      <div className="rounded-xl bg-[#14161B] border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead className="bg-slate-900/50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-3.5 px-5">Tipe & No. Ref</th>
                <th className="py-3.5 px-5">SKU & Nama Barang</th>
                <th className="py-3.5 px-5 text-right">Kuantitas</th>
                <th className="py-3.5 px-5">Pergerakan Rak (From ➔ To)</th>
                <th className="py-3.5 px-5">Operator & Waktu</th>
                <th className="py-3.5 px-5">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 font-mono">
              {filteredTxs.length > 0 ? (
                filteredTxs.map((tx) => {
                  const isInbound = tx.type === 'INBOUND';
                  const isOutbound = tx.type === 'OUTBOUND';
                  const isMovement = tx.type === 'MOVEMENT';
                  const isReturn = tx.type === 'RETURN';
                  const isTransfer = tx.type === 'TRANSFER';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                      
                      {/* Type & Ref */}
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                            isInbound ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            isOutbound ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                            isMovement ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                            isReturn ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                            isTransfer ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                            'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {isInbound ? 'INBOUND' : isOutbound ? 'OUTBOUND' : isMovement ? (tx.subType ? tx.subType.replace('_', ' ') : 'MOVEMENT') : isReturn ? 'RETURN' : isTransfer ? 'MUTASI' : 'OPNAME'}
                          </span>
                          <span className="font-bold text-white text-[11px]">{tx.referenceNumber}</span>
                        </div>
                      </td>

                      {/* SKU & Name */}
                      <td className="py-3 px-5 font-sans">
                        <div className="font-medium text-white flex items-center gap-1.5">
                          <span className="font-mono text-indigo-400 font-medium">{tx.sku}</span>
                          <span>-</span>
                          <span className="truncate max-w-[200px]">{tx.productName}</span>
                        </div>
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-5 text-right">
                        <div className={`font-bold text-sm ${
                          isInbound ? 'text-emerald-400' : isOutbound ? 'text-indigo-400' : 'text-purple-400'
                        }`}>
                          {isInbound ? `+${tx.quantity}` : isOutbound ? `-${tx.quantity}` : `${tx.quantity}`} {tx.unit}
                        </div>
                      </td>

                      {/* Location Path */}
                      <td className="py-3 px-5 text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <span className="px-1.5 py-0.5 rounded bg-[#0A0B0E] border border-slate-800 text-slate-500">
                            {tx.fromLocation || 'Vendor Ext'}
                          </span>
                          <span className="text-slate-600">➔</span>
                          <span className="px-1.5 py-0.5 rounded bg-[#0A0B0E] border border-slate-800 font-medium text-emerald-400">
                            {tx.toLocation || 'Outbound Dock'}
                          </span>
                        </div>
                      </td>

                      {/* Operator & Time */}
                      <td className="py-3 px-5 text-[11px]">
                        <div className="text-white font-medium">{tx.operatorName}</div>
                        <div className="text-slate-500 text-[10px]">{tx.timestamp}</div>
                      </td>

                      {/* Notes */}
                      <td className="py-3 px-5 text-slate-400 font-sans text-xs max-w-xs truncate">
                        {tx.notes || '-'}
                      </td>

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500 font-sans">
                    Tidak ada catatan transaksi pergerakan barang.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Input Transaction Modal */}
      {isNewTxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div 
            className="bg-[#14161B] border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0A0B0E]">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
                Catat Transaksi Pergerakan Barang
              </h3>
              <button onClick={() => setIsNewTxOpen(false)} className="p-1 rounded text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTx} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Jenis Pergerakan:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTxType('INBOUND')}
                    className={`py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 border cursor-pointer ${
                      txType === 'INBOUND'
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-[#0A0B0E] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowDownLeft className="w-4 h-4 text-emerald-400" /> Masuk (Inbound)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxType('OUTBOUND')}
                    className={`py-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 border cursor-pointer ${
                      txType === 'OUTBOUND'
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-[#0A0B0E] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-indigo-400" /> Keluar (Picking)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Pilih SKU Produk:</label>
                <select
                  value={txSku}
                  onChange={(e) => setTxSku(e.target.value)}
                  className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
                >
                  {items.map((i) => (
                    <option key={i.id} value={i.sku}>
                      {i.sku} - {i.name} (Stok: {i.stock} {i.unit} di {i.location.fullCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Kuantitas Unit:</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={txQty}
                    onChange={(e) => setTxQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">No. PO / Surat Jalan:</label>
                  <input
                    type="text"
                    required
                    value={txRef}
                    onChange={(e) => setTxRef(e.target.value)}
                    className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Catatan Tambahan:</label>
                <input
                  type="text"
                  placeholder="Contoh: Penerimaan PO reguler atau pesanan invoice #8812"
                  value={txNotes}
                  onChange={(e) => setTxNotes(e.target.value)}
                  className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {formMsg && (
                <div className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                  formMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{formMsg.text}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewTxOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#0A0B0E] hover:bg-slate-800 text-slate-300 font-semibold border border-slate-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-sm cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
