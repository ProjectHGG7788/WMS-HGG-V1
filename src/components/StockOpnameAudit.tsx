import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  Search, 
  ShieldCheck, 
  Check, 
  MapPin, 
  Lock
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { formatNumber } from '../utils/formatters';

export const StockOpnameAudit: React.FC = () => {
  const { opnameSession, updateOpnameItem, approveOpnameSession, locateSku } = useInventory();
  const { currentUser, hasPermission } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDiscrepancyFilter, setSelectedDiscrepancyFilter] = useState<'ALL' | 'VARIANCE_ONLY' | 'MATCH_ONLY'>('ALL');
  const [isApproving, setIsApproving] = useState(false);
  const [approvalFeedback, setApprovalFeedback] = useState<string | null>(null);

  if (!opnameSession) {
    return (
      <div className="p-8 text-center bg-[#14161B] rounded-xl border border-slate-800 text-slate-400">
        <ClipboardCheck className="w-12 h-12 mx-auto mb-2 text-indigo-400 opacity-60" />
        <h3 className="text-base font-semibold text-white mb-1">Tidak Ada Sesi Opname Aktif</h3>
        <p className="text-xs">Sesi stock opname sedang ditutup atau belum dijadwalkan.</p>
      </div>
    );
  }

  const filteredItems = opnameSession.items.filter((item) => {
    const matchSearch =
      item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.locationCode.toLowerCase().includes(searchQuery.toLowerCase());

    const hasVariance = item.difference !== 0;
    if (selectedDiscrepancyFilter === 'VARIANCE_ONLY') return matchSearch && hasVariance;
    if (selectedDiscrepancyFilter === 'MATCH_ONLY') return matchSearch && !hasVariance;
    return matchSearch;
  });

  const totalVariancesCount = opnameSession.items.filter((i) => i.difference !== 0).length;
  const totalVarianceUnits = opnameSession.items.reduce((acc, item) => acc + item.difference, 0);

  const handleUpdateCount = (sku: string, count: number, notes?: string) => {
    updateOpnameItem(sku, Math.max(0, count), notes);
  };

  const handleApproveAll = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menyetujui hasil Stock Opname ini dan menerapkan penyesuaian stok otomatis ke sistem?')) {
      return;
    }
    setIsApproving(true);
    const res = await approveOpnameSession();
    setIsApproving(false);
    setApprovalFeedback(res.message);
  };

  const isCompleted = opnameSession.status === 'COMPLETED';

  return (
    <div className="space-y-4">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[#14161B] border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <ClipboardCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold text-white">
                Stock Opname Fisik & Rekonsiliasi
              </h2>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                isCompleted
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}>
                {isCompleted ? 'Disetujui & Selesai' : 'Sesi Aktif'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Sesi: <span className="font-mono text-slate-200">{opnameSession.sessionCode}</span> • Mulai: {opnameSession.startDate} • Auditor: {opnameSession.auditorName}
            </p>
          </div>
        </div>

        {/* Manager Approval Button */}
        <div className="flex items-center gap-2">
          {hasPermission('canApproveOpname') && !isCompleted ? (
            <button
              onClick={handleApproveAll}
              disabled={isApproving}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isApproving ? 'Memproses...' : 'Setujui Penyesuaian'}</span>
            </button>
          ) : !hasPermission('canApproveOpname') && !isCompleted ? (
            <div className="text-[11px] text-amber-400 flex items-center gap-1.5 bg-[#0A0B0E] border border-slate-800 px-3 py-1.5 rounded-lg">
              <Lock className="w-3.5 h-3.5" />
              <span>Approval memerlukan role Kepala Gudang</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase font-semibold">Total SKU Di-audit</div>
          <div className="font-mono text-xl font-bold text-white mt-1">
            {formatNumber(opnameSession.items.length)} SKU
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase font-semibold">SKU Sesuai (100%)</div>
          <div className="font-mono text-xl font-bold text-emerald-400 mt-1">
            {formatNumber(opnameSession.items.length - totalVariancesCount)} SKU
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase font-semibold">SKU Selisih (Discrepancy)</div>
          <div className="font-mono text-xl font-bold text-rose-500 mt-1">
            {formatNumber(totalVariancesCount)} SKU
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800">
          <div className="text-[11px] text-slate-500 uppercase font-semibold">Total Selisih Fisik</div>
          <div className={`font-mono text-xl font-bold mt-1 truncate ${totalVarianceUnits < 0 ? 'text-rose-500' : totalVarianceUnits > 0 ? 'text-indigo-400' : 'text-emerald-400'}`}>
            {totalVarianceUnits > 0 ? `+${formatNumber(totalVarianceUnits)}` : formatNumber(totalVarianceUnits)} Unit
          </div>
        </div>
      </div>

      {approvalFeedback && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{approvalFeedback}</span>
        </div>
      )}

      {/* Filters */}
      <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari SKU, Nama Produk, atau Lokasi Rak..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-[#0A0B0E] p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setSelectedDiscrepancyFilter('ALL')}
            className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
              selectedDiscrepancyFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Semua ({formatNumber(opnameSession.items.length)})
          </button>
          <button
            onClick={() => setSelectedDiscrepancyFilter('VARIANCE_ONLY')}
            className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
              selectedDiscrepancyFilter === 'VARIANCE_ONLY' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Ada Selisih ({formatNumber(totalVariancesCount)})
          </button>
          <button
            onClick={() => setSelectedDiscrepancyFilter('MATCH_ONLY')}
            className={`px-3 py-1 rounded font-medium transition-colors cursor-pointer ${
              selectedDiscrepancyFilter === 'MATCH_ONLY' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Cocok
          </button>
        </div>
      </div>

      {/* Audit Checklist Table */}
      <div className="rounded-xl bg-[#14161B] border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead className="bg-slate-900/50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-3.5 px-5">SKU & Lokasi Rak</th>
                <th className="py-3.5 px-5">Nama Produk</th>
                <th className="py-3.5 px-5 text-center">Stok Sistem</th>
                <th className="py-3.5 px-5 text-center">Hasil Hitung Fisik</th>
                <th className="py-3.5 px-5 text-center">Selisih (Variance)</th>
                <th className="py-3.5 px-5">Keterangan / Investigasi QC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredItems.map((item) => {
                return (
                  <tr key={item.sku} className="hover:bg-slate-800/30 transition-colors">
                    
                    {/* SKU & Location */}
                    <td className="py-3 px-5 font-mono">
                      <div className="font-semibold text-white">{item.sku}</div>
                      <button
                        onClick={() => locateSku(item.sku)}
                        className="text-[11px] text-indigo-400 hover:underline flex items-center gap-1 mt-0.5 cursor-pointer"
                      >
                        <MapPin className="w-3 h-3 text-rose-400" />
                        <span>{item.locationCode}</span>
                      </button>
                    </td>

                    {/* Product Name */}
                    <td className="py-3 px-5 font-medium text-slate-200">
                      {item.productName}
                    </td>

                    {/* System Expected Stock */}
                    <td className="py-3 px-5 text-center font-mono font-bold text-slate-400">
                      {formatNumber(item.systemStock)}
                    </td>

                    {/* Physical Counted Stock (Editable Input) */}
                    <td className="py-3 px-5 text-center">
                      <div className="inline-flex items-center justify-center">
                        <input
                          type="number"
                          min="0"
                          disabled={isCompleted || !hasPermission('canStockOpname')}
                          value={item.physicalCount}
                          onChange={(e) =>
                            handleUpdateCount(item.sku, parseInt(e.target.value) || 0, item.notes)
                          }
                          className="w-20 bg-[#0A0B0E] border border-slate-800 focus:border-indigo-500 rounded-lg px-2 py-1 text-center font-mono font-bold text-xs text-white disabled:opacity-50"
                        />
                      </div>
                    </td>

                    {/* Difference */}
                    <td className="py-3 px-5 text-center font-mono font-bold text-xs">
                      {item.difference === 0 ? (
                        <span className="text-emerald-400 flex items-center justify-center gap-1">
                          <Check className="w-3.5 h-3.5" /> 0 (Pas)
                        </span>
                      ) : item.difference > 0 ? (
                        <span className="text-indigo-400">+{formatNumber(item.difference)} (Surplus)</span>
                      ) : (
                        <span className="text-rose-500">{formatNumber(item.difference)} (Defisit)</span>
                      )}
                    </td>

                    {/* Notes / Reason */}
                    <td className="py-3 px-5">
                      <input
                        type="text"
                        placeholder="Contoh: Kerusakan fisik / salah hitung"
                        disabled={isCompleted || !hasPermission('canStockOpname')}
                        value={item.notes || ''}
                        onChange={(e) =>
                          handleUpdateCount(item.sku, item.physicalCount, e.target.value)
                        }
                        className="w-full bg-[#0A0B0E] border border-slate-800 focus:border-indigo-500 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-600 disabled:opacity-50"
                      />
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
