import React, { useState } from 'react';
import { 
  Search, 
  Plus, 
  Table, 
  Printer, 
  Trash2, 
  Building2, 
  Boxes,
  Layers, 
  Hash, 
  CheckCircle2, 
  AlertCircle,
  ScanLine,
  Filter
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { WarehouseLocator } from '../types';
import { AddLocatorModal } from './AddLocatorModal';
import { LocatorBarcodeModal } from './LocatorBarcodeModal';

export const SKULocatorVisualizer: React.FC = () => {
  const { 
    items, 
    locators, 
    deleteLocator, 
    setIsScannerOpen 
  } = useInventory();

  // Locator Master List Filter & Search
  const [locatorFilterWarehouse, setLocatorFilterWarehouse] = useState<string>('ALL');
  const [locatorFilterType, setLocatorFilterType] = useState<string>('ALL');
  const [locatorSearch, setLocatorSearch] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedLocatorForPrint, setSelectedLocatorForPrint] = useState<WarehouseLocator | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filtered locators for Master List
  const filteredLocators = locators.filter((loc) => {
    const query = locatorSearch.toLowerCase().trim();
    const matchSearch = 
      !query ||
      loc.fullCode.toLowerCase().includes(query) ||
      loc.warehouseCode.toLowerCase().includes(query) ||
      loc.rackOrFloorCode.toLowerCase().includes(query) ||
      (loc.aisle && loc.aisle.toLowerCase().includes(query)) ||
      (loc.level && loc.level.toLowerCase().includes(query)) ||
      (loc.pallet && loc.pallet.toLowerCase().includes(query)) ||
      (loc.occupiedSku && loc.occupiedSku.toLowerCase().includes(query)) ||
      (loc.occupiedProductName && loc.occupiedProductName.toLowerCase().includes(query)) ||
      (loc.notes && loc.notes.toLowerCase().includes(query));

    const matchWh = locatorFilterWarehouse === 'ALL' || loc.warehouseCode === locatorFilterWarehouse;
    const matchType = locatorFilterType === 'ALL' || loc.storageType === locatorFilterType;

    return matchSearch && matchWh && matchType;
  });

  // Unique warehouse codes for filters
  const uniqueWarehouseCodes = Array.from(new Set(locators.map((l) => l.warehouseCode)));

  const handleDeleteLocator = async (id: string) => {
    try {
      const res = await deleteLocator(id);
      if (res.success) {
        setActionNotice({ type: 'success', message: res.message });
      } else {
        setActionNotice({ type: 'error', message: res.message });
      }
      setDeleteConfirmId(null);
      setTimeout(() => setActionNotice(null), 3000);
    } catch {
      setActionNotice({ type: 'error', message: 'Gagal menghapus locator.' });
      setTimeout(() => setActionNotice(null), 3000);
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Top Header & Actions Bar */}
      <div className="p-5 rounded-xl bg-[#14161B] border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base font-semibold text-white tracking-tight">
                  Daftar Master Locator & Posisi Rak Gudang
                </h2>
                <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded text-[10px] uppercase tracking-wider font-bold">
                  Format 5-Komponen
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pusat data master lokasi rak, lantai staging, lorong, tingkat level, dan slot palet WMS
              </p>
            </div>
          </div>

          {/* Quick Actions: Add Locator & Scan Barcode */}
          <div className="flex items-center gap-2.5 flex-wrap">
            
            {/* Quick Barcode Scanner button */}
            <button
              onClick={() => setIsScannerOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-[#0A0B0E] hover:bg-slate-800 border border-slate-800 text-indigo-400 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Pindai Barcode / QR Rak"
            >
              <ScanLine className="w-4 h-4" />
              <span>Scan Locator</span>
            </button>

            {/* "+ Tambah Locator Baru" Button */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Locator Baru</span>
            </button>

          </div>

        </div>

        {/* Action Notice Alert */}
        {actionNotice && (
          <div className={`p-3 rounded-lg text-xs flex items-center gap-2 animate-in fade-in ${
            actionNotice.type === 'success' 
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
          }`}>
            {actionNotice.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{actionNotice.message}</span>
          </div>
        )}

      </div>

      {/* Master Locator Database Table Card */}
      <div className="p-5 rounded-xl bg-[#14161B] border border-slate-800 space-y-4">
        
        {/* Table Filters and Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* Warehouse Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 text-[11px] flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                Kode Gudang:
              </span>
              <select
                value={locatorFilterWarehouse}
                onChange={(e) => setLocatorFilterWarehouse(e.target.value)}
                className="bg-[#0A0B0E] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Semua Gudang ({locators.length})</option>
                {uniqueWarehouseCodes.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>

            {/* Storage Type Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 text-[11px] flex items-center gap-1">
                <Boxes className="w-3.5 h-3.5 text-slate-500" />
                Tipe Penyimpanan:
              </span>
              <select
                value={locatorFilterType}
                onChange={(e) => setLocatorFilterType(e.target.value)}
                className="bg-[#0A0B0E] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Semua Tipe</option>
                <option value="RACK">Rak Standar</option>
                <option value="FLOOR">Floor Storage</option>
                <option value="PALLET_BULK">Palet Berat</option>
                <option value="STAGING">Staging Area</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative min-w-[220px] sm:min-w-[280px]">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari kode locator, rak, SKU, lorong..."
                value={locatorSearch}
                onChange={(e) => setLocatorSearch(e.target.value)}
                className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0A0B0E] text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                <th className="py-3 px-3">Kode Locator (Full Code)</th>
                <th className="py-3 px-3 font-semibold text-indigo-400">1. Kode Gudang *</th>
                <th className="py-3 px-3 font-semibold text-indigo-400">2. Rak / Floor *</th>
                <th className="py-3 px-3">3. Lorong</th>
                <th className="py-3 px-3">4. Level</th>
                <th className="py-3 px-3">5. Palet</th>
                <th className="py-3 px-3">Tipe / Suhu</th>
                <th className="py-3 px-3">Status / Okupansi</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredLocators.length > 0 ? (
                filteredLocators.map((loc) => {
                  // Check if an item in inventory is assigned to this locator
                  const occupiedItem = items.find(
                    (i) => i.location.fullCode === loc.fullCode || i.location.rack === loc.rackOrFloorCode
                  );
                  const isOccupied = !!(loc.occupiedSku || occupiedItem);
                  const occupiedStock = loc.occupiedStock || occupiedItem?.stock || 0;
                  const skuCode = loc.occupiedSku || occupiedItem?.sku;

                  return (
                    <tr key={loc.id} className="hover:bg-slate-800/30 transition-colors group">
                      
                      {/* Full Code */}
                      <td className="py-3 px-3 font-mono font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-indigo-400">{loc.fullCode}</span>
                        </div>
                        {loc.notes && (
                          <div className="text-[10px] text-slate-500 font-sans font-normal truncate max-w-xs mt-0.5">
                            {loc.notes}
                          </div>
                        )}
                      </td>

                      {/* 1. Kode Gudang */}
                      <td className="py-3 px-3 font-mono whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/30 text-indigo-200 font-bold">
                          {loc.warehouseCode}
                        </span>
                      </td>

                      {/* 2. Kode Rak/Floor */}
                      <td className="py-3 px-3 font-mono whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-white font-bold">
                          {loc.rackOrFloorCode}
                        </span>
                      </td>

                      {/* 3. Lorong */}
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {loc.aisle ? `L${loc.aisle.replace(/^L/i, '')}` : <span className="text-slate-600">-</span>}
                      </td>

                      {/* 4. Level */}
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {loc.level ? `Tier ${loc.level}` : <span className="text-slate-600">-</span>}
                      </td>

                      {/* 5. Palet */}
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {loc.pallet ? loc.pallet : <span className="text-slate-600">-</span>}
                      </td>

                      {/* Tipe & Suhu */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5 text-[10px] font-mono">
                          <span className="text-slate-300">{loc.storageType}</span>
                          <span className="text-slate-500">{loc.temperatureType}</span>
                        </div>
                      </td>

                      {/* Status / Okupansi */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        {isOccupied ? (
                          <div className="space-y-0.5">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                              Terisi ({occupiedStock} Unit)
                            </span>
                            {skuCode && (
                              <div className="text-[10px] font-mono text-slate-400 truncate max-w-[140px]">
                                {skuCode}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px]">
                            Tersedia (Kosong)
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* Print Thermal Label Button */}
                          <button
                            onClick={() => setSelectedLocatorForPrint(loc)}
                            className="p-1.5 rounded-lg bg-[#0A0B0E] hover:bg-slate-800 text-slate-400 hover:text-indigo-400 border border-slate-800 transition-colors cursor-pointer"
                            title="Cetak Label Barcode / Stiker Rak"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button with inline confirmation */}
                          {deleteConfirmId === loc.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDeleteLocator(loc.id)}
                                className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                              >
                                Ya, Hapus
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[10px] cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(loc.id)}
                              className="p-1.5 rounded-lg bg-[#0A0B0E] hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 border border-slate-800 hover:border-rose-900 transition-colors cursor-pointer"
                              title="Hapus Locator"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                        </div>
                      </td>

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                    Tidak ada locator yang cocok dengan filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer info */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 font-mono">
          <span>Menampilkan {filteredLocators.length} dari {locators.length} total locator terdaftar.</span>
          <span>Standar Format: [GUDANG]-[RAK/FLR]-[LORONG]-[LEVEL]-[PALET]</span>
        </div>

      </div>

      {/* Add Locator Modal */}
      <AddLocatorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={(newLoc) => {
          setActionNotice({
            type: 'success',
            message: `Locator baru [${newLoc.fullCode}] berhasil ditambahkan ke database!`,
          });
          setTimeout(() => setActionNotice(null), 4000);
        }}
      />

      {/* Print Barcode Label Modal for Locator */}
      <LocatorBarcodeModal
        locator={selectedLocatorForPrint}
        isOpen={!!selectedLocatorForPrint}
        onClose={() => setSelectedLocatorForPrint(null)}
      />

    </div>
  );
};
