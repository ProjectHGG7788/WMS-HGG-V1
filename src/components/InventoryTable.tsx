import React, { useState } from 'react';
import { 
  Boxes, 
  Search, 
  Plus, 
  MapPin, 
  Printer, 
  Edit3, 
  Trash2, 
  ArrowUpDown, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  ScanLine,
  FileSpreadsheet,
  Clock,
  Layers,
  Sparkles,
  Package,
  Calendar
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { InventoryItem } from '../types';
import { formatNumber, formatCbm, calculateCbm, calculateAgingDays, getAgingStatus, normalizeBarcode } from '../utils/formatters';
import { BarcodeLabelGenerator } from './BarcodeLabelGenerator';

export const InventoryTable: React.FC<{ onNavigateTab?: (tab: string) => void }> = ({ onNavigateTab }) => {
  const { items, locateSku, saveItem, deleteItem, setIsScannerOpen } = useInventory();
  const { hasPermission } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [selectedAging, setSelectedAging] = useState<string>('ALL');
  const [sortField, setSortField] = useState<keyof InventoryItem | 'totalCbm' | 'aging'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [printingItem, setPrintingItem] = useState<InventoryItem | null>(null);

  // Form state for 9 master SKU fields
  const [formData, setFormData] = useState<{
    id?: string;
    sku: string;
    barcode: string;
    name: string;
    isiDus: number;
    unit: string;
    brand: string;
    category: string;
    cbmPerUnit: number;
    lastInboundDate: string;
    stock: number;
    minStock: number;
    maxCapacity: number;
    weightKg: number;
    dimensionsCm: { lengthCm: number; widthCm: number; heightCm: number };
    location: {
      zoneId: string;
      zoneName: string;
      aisle: string;
      rack: string;
      shelfLevel: number;
      binSlot: string;
      fullCode: string;
    };
    abcClass: 'A' | 'B' | 'C';
    batchLot: string;
    supplier: string;
    notes: string;
  }>({
    sku: '',
    barcode: '0',
    name: '',
    isiDus: 12,
    unit: 'Pcs',
    brand: 'Generic',
    category: 'Elektronik & Komponen',
    cbmPerUnit: 0.005,
    lastInboundDate: new Date().toISOString().substring(0, 10),
    stock: 50,
    minStock: 20,
    maxCapacity: 200,
    weightKg: 1,
    dimensionsCm: { lengthCm: 25, widthCm: 20, heightCm: 10 },
    location: {
      zoneId: 'A',
      zoneName: 'Zona A - Fast Moving Goods',
      aisle: 'Lorong 01',
      rack: 'Rak 01',
      shelfLevel: 1,
      binSlot: 'A1',
      fullCode: 'A-01-01-L1-A1',
    },
    abcClass: 'B',
    batchLot: 'LOT-2026-08',
    supplier: 'PT Distribusi Nasional',
    notes: '',
  });

  const categories = ['ALL', ...Array.from(new Set(items.map((i) => i.category || 'Umum')))];

  // Calculate totals
  const totalAllStockUnits = items.reduce((acc, curr) => acc + curr.stock, 0);
  const totalAllStockCbm = items.reduce((acc, curr) => acc + (curr.stock * (curr.cbmPerUnit || 0)), 0);

  // Filtering & Sorting logic
  const filteredItems = items
    .filter((item) => {
      const barcodeNorm = normalizeBarcode(item.barcode);
      const agingDays = calculateAgingDays(item.lastInboundDate, item.lastUpdated);

      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        barcodeNorm.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.location.fullCode.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchStatus = selectedStatus === 'ALL' || item.status === selectedStatus;
      const matchZone = selectedZone === 'ALL' || item.location.zoneId === selectedZone;

      let matchAging = true;
      if (selectedAging === 'FRESH') matchAging = agingDays <= 14;
      else if (selectedAging === 'NORMAL') matchAging = agingDays > 14 && agingDays <= 30;
      else if (selectedAging === 'MODERATE') matchAging = agingDays > 30 && agingDays <= 60;
      else if (selectedAging === 'SLOW') matchAging = agingDays > 60 && agingDays <= 90;
      else if (selectedAging === 'CRITICAL') matchAging = agingDays > 90;

      return matchSearch && matchCategory && matchStatus && matchZone && matchAging;
    })
    .sort((a, b) => {
      if (sortField === 'totalCbm') {
        const aCbm = a.stock * (a.cbmPerUnit || 0);
        const bCbm = b.stock * (b.cbmPerUnit || 0);
        return sortOrder === 'asc' ? aCbm - bCbm : bCbm - aCbm;
      }
      if (sortField === 'aging') {
        const aAging = calculateAgingDays(a.lastInboundDate, a.lastUpdated);
        const bAging = calculateAgingDays(b.lastInboundDate, b.lastUpdated);
        return sortOrder === 'asc' ? aAging - bAging : bAging - aAging;
      }
      let aVal = a[sortField as keyof InventoryItem];
      let bVal = b[sortField as keyof InventoryItem];
      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string);
      }
      if (typeof aVal === 'number') {
        return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
      }
      return 0;
    });

  const filteredTotalUnits = filteredItems.reduce((acc, curr) => acc + curr.stock, 0);
  const filteredTotalCbm = filteredItems.reduce((acc, curr) => acc + (curr.stock * (curr.cbmPerUnit || 0)), 0);

  const handleSort = (field: keyof InventoryItem | 'totalCbm' | 'aging') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleOpenAdd = () => {
    const randomSku = `SKU-${Date.now().toString().slice(-4)}`;
    setFormData({
      sku: randomSku,
      barcode: '0',
      name: '',
      isiDus: 12,
      unit: 'Pcs',
      brand: 'Generic',
      category: 'Elektronik & Komponen',
      cbmPerUnit: 0.005,
      lastInboundDate: new Date().toISOString().substring(0, 10),
      stock: 50,
      minStock: 20,
      maxCapacity: 200,
      weightKg: 1.0,
      dimensionsCm: { lengthCm: 25, widthCm: 20, heightCm: 10 },
      location: {
        zoneId: 'A',
        zoneName: 'Zona A - Fast Moving Goods',
        aisle: 'Lorong 01',
        rack: 'Rak 01',
        shelfLevel: 1,
        binSlot: 'A1',
        fullCode: 'A-01-01-L1-A1',
      },
      abcClass: 'B',
      batchLot: `LOT-${new Date().getFullYear()}-01`,
      supplier: 'PT Distribusi Nasional',
      notes: '',
    });
    setEditingItem(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      id: item.id,
      sku: item.sku,
      barcode: normalizeBarcode(item.barcode),
      name: item.name,
      isiDus: item.isiDus || 1,
      unit: item.unit || 'Pcs',
      brand: item.brand || 'Generic',
      category: item.category || 'Umum',
      cbmPerUnit: Number(Number(item.cbmPerUnit || 0.005).toFixed(3)),
      lastInboundDate: item.lastInboundDate || item.lastUpdated?.substring(0, 10) || new Date().toISOString().substring(0, 10),
      stock: item.stock,
      minStock: item.minStock,
      maxCapacity: item.maxCapacity || 200,
      weightKg: item.weightKg || 1,
      dimensionsCm: item.dimensionsCm || { lengthCm: 20, widthCm: 15, heightCm: 10 },
      location: item.location,
      abcClass: item.abcClass || 'B',
      batchLot: item.batchLot || 'LOT-01',
      supplier: item.supplier || '',
      notes: item.notes || '',
    });
    setIsAddModalOpen(true);
  };

  const handleDimensionChange = (field: 'lengthCm' | 'widthCm' | 'heightCm', val: number) => {
    const currentDims = formData.dimensionsCm || { lengthCm: 20, widthCm: 15, heightCm: 10 };
    const updatedDims = { ...currentDims, [field]: val };
    const updatedCbm = Number(calculateCbm(updatedDims.lengthCm, updatedDims.widthCm, updatedDims.heightCm).toFixed(3));
    setFormData({
      ...formData,
      dimensionsCm: updatedDims,
      cbmPerUnit: updatedCbm,
    });
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.sku) return;

    const locZone = formData.location?.zoneId || 'A';
    const locAisle = formData.location?.aisle || 'Lorong 01';
    const locRack = formData.location?.rack || 'Rak 01';
    const locLvl = formData.location?.shelfLevel || 1;
    const locSlot = formData.location?.binSlot || 'A1';
    const fullCode = `${locZone}-${locAisle.replace('Lorong ', '')}-${locRack.replace('Rak ', '')}-L${locLvl}-${locSlot}`;

    const barcodeClean = normalizeBarcode(formData.barcode);

    const payload: Partial<InventoryItem> = {
      ...formData,
      barcode: barcodeClean,
      cbmPerUnit: Number(Number(formData.cbmPerUnit || 0.001).toFixed(3)),
      isiDus: Number(formData.isiDus) || 1,
      id: editingItem ? editingItem.id : undefined,
      location: {
        zoneId: locZone,
        zoneName: `Zona ${locZone}`,
        aisle: locAisle,
        rack: locRack,
        shelfLevel: locLvl,
        binSlot: locSlot,
        fullCode,
      },
    };

    await saveItem(payload);
    setIsAddModalOpen(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus barang "${name}" dari inventaris?`)) {
      await deleteItem(id);
    }
  };

  return (
    <div id="inventory-master-view" className="space-y-4">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-xl bg-[#14161B] border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-white tracking-tight">
                Master Data SKU & Stok Gudang
              </h2>
              <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] uppercase tracking-wider font-bold text-slate-300">
                {items.length} SKU Terdaftar
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Kelola struktur 9 atribut Master SKU: SKU ID, Barcode (0 jika belum ada), Deskripsi, Isi Dus, Satuan (UOM), Brand, Kategori, Kubikasi (3 desimal), & Aging (Hari).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateTab && (
            <button
              id="btn-nav-upload-master"
              onClick={() => onNavigateTab('upload-master')}
              className="px-3 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Upload Opbal & Master Excel</span>
            </button>
          )}

          <button
            id="btn-scan-sku"
            onClick={() => setIsScannerOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-[#0A0B0E] hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <ScanLine className="w-4 h-4 text-emerald-400" />
            <span>Pindai Cepat</span>
          </button>
          
          <button
            id="btn-add-sku"
            onClick={handleOpenAdd}
            disabled={!hasPermission('canInbound')}
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah SKU</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#14161B] border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Total SKU Master</div>
            <div className="text-lg font-bold text-white font-mono">{items.length} <span className="text-xs text-slate-400 font-normal">SKU</span></div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold font-mono">
            SKU
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#14161B] border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Total Stok Fisik</div>
            <div className="text-lg font-bold text-emerald-400 font-mono">{formatNumber(totalAllStockUnits)} <span className="text-xs text-slate-400 font-normal">Qty</span></div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xs font-bold font-mono">
            QTY
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#14161B] border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-indigo-300 font-medium">Total Kubikasi (CBM)</div>
            <div className="text-lg font-bold text-indigo-400 font-mono">{formatCbm(totalAllStockCbm)}</div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-bold font-mono">
            m³
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#14161B] border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400 font-medium">Hasil Filter SKU</div>
            <div className="text-sm font-bold text-slate-200 font-mono">
              {filteredItems.length} SKU ({formatNumber(filteredTotalUnits)} Qty)
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold font-mono">
            FIL
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-xl bg-[#14161B] border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-search-sku"
            type="text"
            placeholder="Cari SKU ID, Barcode, Nama Produk, Brand, atau Lokasi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <select
            id="filter-category"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#0A0B0E] border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'ALL' ? 'Semua Kategori' : c}
              </option>
            ))}
          </select>

          <select
            id="filter-status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#0A0B0E] border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Semua Status Stok</option>
            <option value="IN_STOCK">Stok Aman (In Stock)</option>
            <option value="LOW_STOCK">Stok Menipis (Low Stock)</option>
            <option value="OUT_OF_STOCK">Stok Habis (Out of Stock)</option>
          </select>

          <select
            id="filter-aging"
            value={selectedAging}
            onChange={(e) => setSelectedAging(e.target.value)}
            className="bg-[#0A0B0E] border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Semua Status Aging</option>
            <option value="FRESH">Fresh (&le; 14 Hari)</option>
            <option value="NORMAL">Normal (15 - 30 Hari)</option>
            <option value="MODERATE">Sedang (31 - 60 Hari)</option>
            <option value="SLOW">Slow Moving (61 - 90 Hari)</option>
            <option value="CRITICAL">Critical Aging (&gt; 90 Hari)</option>
          </select>

          <select
            id="filter-zone"
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="bg-[#0A0B0E] border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">Semua Zona Rak</option>
            <option value="A">Zona A</option>
            <option value="B">Zona B</option>
            <option value="C">Zona C</option>
            <option value="D">Zona D</option>
          </select>
        </div>

      </div>

      {/* Main Inventory Table with 9 Master SKU Columns */}
      <div className="rounded-xl bg-[#14161B] border border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table id="table-master-sku" className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead className="bg-slate-900/75 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-3.5 px-4 cursor-pointer" onClick={() => handleSort('sku')}>
                  <div className="flex items-center gap-1">
                    <span>1. SKU ID & 2. Barcode</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3.5 px-4 cursor-pointer" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1">
                    <span>3. Deskripsi SKU & Brand / Kategori</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3.5 px-3 text-center">4. Isi Dus & 5. UOM</th>
                <th className="py-3.5 px-4">Lokasi Rak</th>
                <th className="py-3.5 px-4 cursor-pointer text-right" onClick={() => handleSort('stock')}>
                  <div className="flex items-center justify-end gap-1">
                    <span>Stok Saat Ini</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3.5 px-4 cursor-pointer text-right" onClick={() => handleSort('cbmPerUnit')}>
                  <div className="flex items-center justify-end gap-1 text-indigo-300">
                    <span>8. Kubikasi (m³)</span>
                    <ArrowUpDown className="w-3 h-3 text-indigo-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4 cursor-pointer text-center" onClick={() => handleSort('aging')}>
                  <div className="flex items-center justify-center gap-1 text-amber-300">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>9. Aging (Day)</span>
                    <ArrowUpDown className="w-3 h-3 text-amber-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const isLow = item.status === 'LOW_STOCK';
                  const isOut = item.status === 'OUT_OF_STOCK';
                  const barcodeVal = normalizeBarcode(item.barcode);
                  const isZeroBarcode = barcodeVal === '0';
                  const itemCbm = Number(Number(item.cbmPerUnit || 0.001).toFixed(3));
                  const itemTotalCbm = item.stock * itemCbm;
                  const agingDays = calculateAgingDays(item.lastInboundDate, item.lastUpdated);
                  const agingMeta = getAgingStatus(agingDays);
                  const isiDusVal = item.isiDus || 1;
                  const dusEquiv = (item.stock / isiDusVal).toFixed(1);

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                      
                      {/* 1. SKU ID & 2. Barcode */}
                      <td className="py-3 px-4 font-mono">
                        <div className="font-semibold text-indigo-400 flex items-center gap-1.5">
                          <span>{item.sku}</span>
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded font-sans">
                            {item.abcClass || 'B'}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1">
                          {isZeroBarcode ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400 font-mono" title="Tidak ada barcode terdaftar (Otomatis 0)">
                              Barcode: 0 (Unregistered)
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono tracking-tight flex items-center gap-1">
                              <ScanLine className="w-3 h-3 text-slate-500" />
                              {barcodeVal}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Deskripsi SKU & 6. Brand & 7. Kategori */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-white group-hover:text-indigo-200 transition-colors max-w-xs truncate" title={item.name}>
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="px-1.5 py-0.2 bg-slate-800/80 border border-slate-700/60 rounded text-[10px] text-slate-300 font-medium">
                            {item.brand || 'Generic'}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400">{item.category}</span>
                        </div>
                      </td>

                      {/* 4. Isi Dus & 5. Satuan (UOM) */}
                      <td className="py-3 px-3 text-center">
                        <div className="font-mono text-xs font-semibold text-slate-200">
                          {isiDusVal} <span className="text-[10px] text-slate-400 font-normal">{item.unit}/Dus</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          UOM: <span className="font-medium text-slate-300">{item.unit || 'Pcs'}</span>
                        </div>
                      </td>

                      {/* Locator Lokasi Rak */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => {
                            locateSku(item.sku);
                            if (onNavigateTab) onNavigateTab('locator');
                          }}
                          className="font-mono text-xs text-emerald-400 bg-[#0A0B0E] border border-slate-800 hover:border-emerald-500/50 px-2 py-1 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                          title="Lacak posisi fisik barang di Master Locator Gudang"
                        >
                          <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span className="truncate max-w-[140px]">{item.location?.fullCode || '-'}</span>
                        </button>
                      </td>

                      {/* Stock Level */}
                      <td className="py-3 px-4 text-right font-mono">
                        <div className={`font-bold text-sm ${isOut ? 'text-rose-500' : isLow ? 'text-amber-500' : 'text-white'}`}>
                          {formatNumber(item.stock)} <span className="text-[11px] font-normal text-slate-400">{item.unit}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          &asymp; {dusEquiv} Dus (Min: {item.minStock})
                        </div>
                      </td>

                      {/* 8. Kubikasi (m3 manual 3 desimal) */}
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        <div className="text-indigo-300 text-xs font-semibold">
                          {itemCbm.toFixed(3)} <span className="text-[10px] text-slate-400 font-normal">m³/u</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Total: <span className="text-slate-300 font-medium">{formatCbm(itemTotalCbm)}</span>
                        </div>
                      </td>

                      {/* 9. Aging (Day) */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <div className={`px-2 py-0.5 rounded-full border text-[11px] font-mono font-bold flex items-center gap-1.5 ${agingMeta.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${agingMeta.dotColor}`} />
                            <span>{agingDays} Hari</span>
                          </div>
                          <div className="text-[9px] text-slate-500 mt-0.5">
                            {agingMeta.label}
                          </div>
                        </div>
                      </td>

                      {/* Status badge */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 text-xs">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOut ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                          <span className="text-slate-300 text-[11px]">
                            {isOut ? 'Habis' : isLow ? 'Menipis' : 'Aman'}
                          </span>
                        </div>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Print Label */}
                          <button
                            onClick={() => setPrintingItem(item)}
                            className="p-1.5 rounded bg-[#0A0B0E] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                            title="Cetak Stiker Barcode SKU"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Item */}
                          <button
                            onClick={() => handleOpenEdit(item)}
                            disabled={!hasPermission('canAdjustStock') && !hasPermission('canInbound')}
                            className="p-1.5 rounded bg-[#0A0B0E] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
                            title="Edit Data Master SKU"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Item */}
                          {hasPermission('canManageUsers') && (
                            <button
                              onClick={() => handleDelete(item.id, item.name)}
                              className="p-1.5 rounded bg-[#0A0B0E] hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors cursor-pointer"
                              title="Hapus SKU"
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
                  <td colSpan={9} className="text-center py-10 text-slate-500">
                    <Boxes className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Tidak ada barang inventaris yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Master SKU Modal (With 9 Mandatory Fields) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div 
            className="bg-[#14161B] border border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#0A0B0E]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs font-bold">
                  <Package className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-semibold text-white">
                  {editingItem ? 'Edit Master SKU (9 Atribut Baku)' : 'Tambah Master SKU Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              
              {/* Field 1 & 2: SKU ID & Barcode */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#0A0B0E] border border-slate-800">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">
                    1. SKU ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: SKU-ELK-001"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Kode identifikasi unik produk</span>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">
                    2. Barcode (Default 0 jika kosong)
                  </label>
                  <input
                    type="text"
                    placeholder="Barcode resmi atau 0"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Jika tidak ada barcode terdaftar, sistem mengisi angka 0</span>
                </div>
              </div>

              {/* Field 3: Deskripsi SKU */}
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  3. Deskripsi SKU (Nama Barang) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Router Wi-Fi 6 Dual Band Gigabit"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Field 4, 5, 6, 7: Isi Dus, Satuan (UOM), Brand, Kategori */}
              <div className="grid grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">4. Isi Dus *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.isiDus}
                    onChange={(e) => setFormData({ ...formData, isiDus: parseInt(e.target.value) || 1 })}
                    className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">5. Satuan (UOM) *</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-2.5 py-1.5 text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Set">Set</option>
                    <option value="Dus">Dus</option>
                    <option value="Unit">Unit</option>
                    <option value="Karton">Karton</option>
                    <option value="Box">Box</option>
                    <option value="Kg">Kg</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">6. Brand</label>
                  <input
                    type="text"
                    placeholder="Merk / Brand"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-2.5 py-1.5 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">7. Kategori</label>
                  <input
                    type="text"
                    placeholder="Kategori"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-2.5 py-1.5 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Field 8 & 9: Kubikasi Manual (3 Desimal) & Aging / Inbound Date */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-[#0A0B0E] border border-indigo-950/60">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-indigo-300 font-semibold flex items-center gap-1">
                      <span>8. Kubikasi (m³) *</span>
                    </label>
                    <span className="text-[10px] text-slate-500">Manual 3 desimal</span>
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={formData.cbmPerUnit}
                    onChange={(e) => setFormData({ ...formData, cbmPerUnit: parseFloat(e.target.value) || 0.001 })}
                    className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Total: {formatCbm((formData.stock || 0) * (formData.cbmPerUnit || 0.001))}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-amber-300 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>9. Aging / Tgl Inbound</span>
                    </label>
                    <span className="text-[10px] text-amber-400/80 font-mono">
                      {calculateAgingDays(formData.lastInboundDate)} Hari Berjalan
                    </span>
                  </div>
                  <input
                    type="date"
                    required
                    value={formData.lastInboundDate}
                    onChange={(e) => setFormData({ ...formData, lastInboundDate: e.target.value })}
                    className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Aging dihitung dari tanggal Inbound terakhir
                  </span>
                </div>
              </div>

              {/* Stock Numbers */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-[#0A0B0E] border border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Stok Fisik Awal:</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Safety Stock (Min):</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Kapasitas Maksimal Rak:</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxCapacity}
                    onChange={(e) => setFormData({ ...formData, maxCapacity: parseInt(e.target.value) || 100 })}
                    className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-3 py-1.5 text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Locator Selection */}
              <div className="p-3 rounded-lg bg-[#0A0B0E] border border-slate-800 space-y-2">
                <div className="text-indigo-400 font-semibold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  Alokasi Posisi Rak Gudang (Master Locator):
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">Zona:</label>
                    <select
                      value={formData.location?.zoneId || 'A'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          location: { ...(formData.location as any), zoneId: e.target.value },
                        })
                      }
                      className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-2 py-1 text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="A">Zona A</option>
                      <option value="B">Zona B</option>
                      <option value="C">Zona C</option>
                      <option value="D">Zona D</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Lorong:</label>
                    <select
                      value={formData.location?.aisle || 'Lorong 01'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          location: { ...(formData.location as any), aisle: e.target.value },
                        })
                      }
                      className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-2 py-1 text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="Lorong 01">Lorong 01</option>
                      <option value="Lorong 02">Lorong 02</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Rak:</label>
                    <select
                      value={formData.location?.rack || 'Rak 01'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          location: { ...(formData.location as any), rack: e.target.value },
                        })
                      }
                      className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-2 py-1 text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="Rak 01">Rak 01</option>
                      <option value="Rak 02">Rak 02</option>
                      <option value="Rak 03">Rak 03</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Slot Bin:</label>
                    <select
                      value={formData.location?.binSlot || 'A1'}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          location: { ...(formData.location as any), binSlot: e.target.value },
                        })
                      }
                      className="w-full bg-[#14161B] border border-slate-800 rounded-lg px-2 py-1 text-white focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="A1">A1</option>
                      <option value="A2">A2</option>
                      <option value="B1">B1</option>
                      <option value="B2">B2</option>
                      <option value="C1">C1</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#0A0B0E] hover:bg-slate-800 text-slate-300 font-semibold border border-slate-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-sm cursor-pointer"
                >
                  Simpan Master SKU
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Sticker Generator Modal */}
      <BarcodeLabelGenerator
        item={printingItem}
        isOpen={!!printingItem}
        onClose={() => setPrintingItem(null)}
      />

    </div>
  );
};
