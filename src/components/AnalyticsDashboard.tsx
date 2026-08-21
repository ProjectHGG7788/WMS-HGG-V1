import React, { useState } from 'react';
import { 
  Boxes, 
  Layers, 
  ScanLine, 
  MapPin, 
  Building2, 
  Warehouse, 
  Eye, 
  ChevronRight, 
  X, 
  Search, 
  Sparkles, 
  FileSpreadsheet, 
  BarChart3, 
  PieChart as PieChartIcon,
  PackageCheck,
  TrendingUp,
  BoxesIcon,
  ArrowUpRight,
  Info
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell
} from 'recharts';
import { useInventory } from '../context/InventoryContext';
import { useAuth } from '../context/AuthContext';
import { formatNumber, formatCbm, formatCbmValue } from '../utils/formatters';
import { InventoryItem } from '../types';

export interface WarehouseStats {
  code: string;
  name: string;
  typeLabel: string;
  locationNote: string;
  totalSkus: number;
  totalQty: number;
  qtySharePct: number;
  totalCbm: number;
  cbmSharePct: number;
  maxCapacityCbm: number;
  remainingCbm: number;
  cbmOccupancyPct: number;
  capacityUnits: number;
  locatorsCount: number;
  occupiedLocatorsCount: number;
  color: string;
  badgeBg: string;
  badgeText: string;
  categoriesSummary: { category: string; qty: number; cbm: number }[];
  items: InventoryItem[];
}

export const AnalyticsDashboard: React.FC<{ onNavigateTab?: (tab: string) => void }> = ({ onNavigateTab }) => {
  const { items, zones, locators, transactions, analytics, locateSku, setIsScannerOpen } = useInventory();
  const { currentUser } = useAuth();
  const [occupancyViewMode, setOccupancyViewMode] = useState<'warehouse' | 'zone'>('warehouse');
  const [selectedWarehouseForDetail, setSelectedWarehouseForDetail] = useState<WarehouseStats | null>(null);
  const [warehouseSearchQuery, setWarehouseSearchQuery] = useState('');

  // 7-day movement trend data
  const movementTrendData = [
    { day: 'Sen', masuk: 180, keluar: 140, net: 40 },
    { day: 'Sel', masuk: 220, keluar: 195, net: 25 },
    { day: 'Rab', masuk: 140, keluar: 210, net: -70 },
    { day: 'Kam', masuk: 310, keluar: 260, net: 50 },
    { day: 'Jum', masuk: 290, keluar: 275, net: 15 },
    { day: 'Sab', masuk: 95, keluar: 110, net: -15 },
    { day: 'Min', masuk: 145, keluar: 105, net: 40 },
  ];

  // Category distribution data with units and CBM
  const categoryData = [
    { 
      name: 'FMCG & Makanan', 
      value: items.filter((i) => i.category === 'FMCG & Makanan').reduce((a, b) => a + b.stock, 0), 
      cbm: items.filter((i) => i.category === 'FMCG & Makanan').reduce((a, b) => a + (b.stock * (b.cbmPerUnit || 0)), 0),
      color: '#10b981' 
    },
    { 
      name: 'Elektronik & IT', 
      value: items.filter((i) => i.category === 'Elektronik & Komponen').reduce((a, b) => a + b.stock, 0), 
      cbm: items.filter((i) => i.category === 'Elektronik & Komponen').reduce((a, b) => a + (b.stock * (b.cbmPerUnit || 0)), 0),
      color: '#6366f1' 
    },
    { 
      name: 'Peralatan Medis', 
      value: items.filter((i) => i.category === 'Peralatan Medis').reduce((a, b) => a + b.stock, 0), 
      cbm: items.filter((i) => i.category === 'Peralatan Medis').reduce((a, b) => a + (b.stock * (b.cbmPerUnit || 0)), 0),
      color: '#8b5cf6' 
    },
    { 
      name: 'Kimia & Khusus', 
      value: items.filter((i) => i.category === 'Bahan Kimia Industri').reduce((a, b) => a + b.stock, 0), 
      cbm: items.filter((i) => i.category === 'Bahan Kimia Industri').reduce((a, b) => a + (b.stock * (b.cbmPerUnit || 0)), 0),
      color: '#f43f5e' 
    },
    { 
      name: 'Suku Cadang', 
      value: items.filter((i) => i.category === 'Suku Cadang Otomotif').reduce((a, b) => a + b.stock, 0), 
      cbm: items.filter((i) => i.category === 'Suku Cadang Otomotif').reduce((a, b) => a + (b.stock * (b.cbmPerUnit || 0)), 0),
      color: '#f59e0b' 
    },
  ];

  // Zone capacity utilization with CBM calculation
  const zoneStats = zones.map((zone) => {
    const totalZoneStock = items
      .filter((i) => i.location.zoneId === zone.id)
      .reduce((a, b) => a + b.stock, 0);
    const totalZoneCbm = items
      .filter((i) => i.location.zoneId === zone.id)
      .reduce((a, b) => a + (b.stock * (b.cbmPerUnit || 0)), 0);
    const pct = Math.round((totalZoneStock / zone.maxCapacity) * 100);
    return {
      id: zone.id,
      name: zone.name.split(' - ')[0],
      current: totalZoneStock,
      cbm: totalZoneCbm,
      max: zone.maxCapacity,
      pct,
    };
  });

  // Multi-Warehouse Configurations & Calculations (Including CBM Capacity for space analysis)
  const WAREHOUSE_CONFIGS: Record<string, { 
    name: string; 
    typeLabel: string;
    locationNote: string; 
    color: string; 
    badgeBg: string; 
    badgeText: string; 
    defaultCapacityCbm: number; // Kapasitas Ruang Kubikasi (CBM / m³)
    defaultCapacityUnits: number;
  }> = {
    'GDG-01': {
      name: 'Gudang Pusat Cikarang',
      typeLabel: 'Pusat Distribusi Nasional (Central Hub)',
      locationNote: 'Kawasan Industri GIIC Cikarang, Blok AA-08, Jawa Barat',
      color: '#6366f1',
      badgeBg: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
      badgeText: 'text-indigo-400',
      defaultCapacityCbm: 50.0, // 50 m³ kapasitas ruang rak
      defaultCapacityUnits: 2500,
    },
    'GDG-02': {
      name: 'Gudang Transit Surabaya',
      typeLabel: 'Cabang Hub Logistik Regional Timur',
      locationNote: 'Kawasan Pergudangan Margomulyo Indah Blok C-12, Surabaya',
      color: '#06b6d4',
      badgeBg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',
      badgeText: 'text-cyan-400',
      defaultCapacityCbm: 20.0, // 20 m³ kapasitas ruang rak
      defaultCapacityUnits: 1000,
    },
    'GDG-03': {
      name: 'Gudang Hub Medan',
      typeLabel: 'Fasilitas Distribusi Wilayah Sumatera',
      locationNote: 'Kawasan Industri Medan (KIM 2) Tahap II, Sumatera Utara',
      color: '#10b981',
      badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      badgeText: 'text-emerald-400',
      defaultCapacityCbm: 15.0, // 15 m³ kapasitas ruang rak
      defaultCapacityUnits: 800,
    },
  };

  const locatorWhCodes = locators.map((l) => l.warehouseCode).filter(Boolean);
  const allWhCodes = Array.from(new Set(['GDG-01', 'GDG-02', ...locatorWhCodes]));

  const warehouseStats: WarehouseStats[] = allWhCodes.map((whCode) => {
    const config = WAREHOUSE_CONFIGS[whCode] || {
      name: locators.find((l) => l.warehouseCode === whCode)?.warehouseName || `Gudang ${whCode}`,
      typeLabel: 'Fasilitas Cabang / Hub Logistik Regional',
      locationNote: 'Fasilitas Pergudangan Jaringan Distribusi',
      color: '#8b5cf6',
      badgeBg: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
      badgeText: 'text-purple-400',
      defaultCapacityCbm: 15.0,
      defaultCapacityUnits: 1000,
    };

    const whLocators = locators.filter(
      (l) =>
        l.warehouseCode === whCode ||
        (whCode === 'GDG-01' && (!l.warehouseCode || l.fullCode.startsWith('GDG01') || !l.warehouseCode.startsWith('GDG-')))
    );

    const whItems = items.filter((item) => {
      const loc = locators.find(
        (l) => l.fullCode === item.location.fullCode || l.occupiedSku === item.sku
      );
      if (loc && loc.warehouseCode) {
        return loc.warehouseCode === whCode;
      }
      const fullCode = item.location.fullCode || '';
      if (whCode === 'GDG-02' && (fullCode.startsWith('GDG02') || fullCode.startsWith('GDG-02'))) {
        return true;
      }
      if (whCode === 'GDG-03' && (fullCode.startsWith('GDG03') || fullCode.startsWith('GDG-03'))) {
        return true;
      }
      if (whCode === 'GDG-01') {
        return (
          fullCode.startsWith('GDG01') ||
          fullCode.startsWith('GDG-01') ||
          ['A', 'B', 'C', 'D'].includes(item.location.zoneId) ||
          (!fullCode.startsWith('GDG02') && !fullCode.startsWith('GDG03'))
        );
      }
      return false;
    });

    const totalQty = whItems.reduce((acc, i) => acc + i.stock, 0);
    const totalCbm = Number(
      whItems.reduce((acc, i) => acc + (i.stock * (i.cbmPerUnit || 0)), 0).toFixed(4)
    );
    
    // Kapasitas CBM maksimal untuk analisa space
    const maxCapacityCbm = config.defaultCapacityCbm;
    // Utilisasi dihitung MURNI berdasarkan CBM (Kubikasi m³)
    const cbmOccupancyPct = Math.min(100, Math.round((totalCbm / (maxCapacityCbm || 1)) * 100));
    // Sisa space kubikasi
    const remainingCbm = Number(Math.max(0, maxCapacityCbm - totalCbm).toFixed(3));

    const locatorCapacity = whLocators.reduce((acc, l) => acc + (l.maxCapacityUnits || 0), 0);
    const capacityUnits = Math.max(locatorCapacity, config.defaultCapacityUnits);
    const occupiedLocatorsCount = whLocators.filter(
      (l) => l.status === 'OCCUPIED' || (l.occupiedStock && l.occupiedStock > 0)
    ).length;

    const totalNetworkUnits = analytics.totalUnits || 1;
    const totalNetworkCbm = analytics.totalCbm || 1;
    const qtySharePct = Math.round((totalQty / totalNetworkUnits) * 100);
    const cbmSharePct = Math.round((totalCbm / totalNetworkCbm) * 100);

    // Group categories in this warehouse
    const catMap = new Map<string, { qty: number; cbm: number }>();
    whItems.forEach((it) => {
      const cat = it.category || 'Lainnya';
      const cur = catMap.get(cat) || { qty: 0, cbm: 0 };
      catMap.set(cat, {
        qty: cur.qty + it.stock,
        cbm: cur.cbm + (it.stock * (it.cbmPerUnit || 0))
      });
    });
    const categoriesSummary = Array.from(catMap.entries()).map(([category, vals]) => ({
      category,
      qty: vals.qty,
      cbm: vals.cbm
    }));

    return {
      code: whCode,
      name: config.name,
      typeLabel: config.typeLabel,
      locationNote: config.locationNote,
      totalSkus: whItems.length,
      totalQty,
      qtySharePct,
      totalCbm,
      cbmSharePct,
      maxCapacityCbm,
      remainingCbm,
      cbmOccupancyPct,
      capacityUnits,
      locatorsCount: whLocators.length,
      occupiedLocatorsCount,
      color: config.color,
      badgeBg: config.badgeBg,
      badgeText: config.badgeText,
      categoriesSummary,
      items: whItems,
    };
  });

  // Global CBM calculations across all active warehouses
  const totalNetworkMaxCbm = warehouseStats.reduce((acc, wh) => acc + wh.maxCapacityCbm, 0) || 85;
  const globalCbmOccupancyPct = Math.min(100, Math.round((analytics.totalCbm / (totalNetworkMaxCbm || 1)) * 100));
  const globalRemainingCbm = Number(Math.max(0, totalNetworkMaxCbm - analytics.totalCbm).toFixed(3));

  return (
    <div className="space-y-6">
      
      {/* Top Header bar inside Analytics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white">Warehouse Analytics</h1>
            <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] uppercase tracking-wider font-bold text-slate-400">
              Real-time
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Monitoring operasional multi-gudang, perputaran stok, kubikasi volume (CBM), dan occupancy rate fasilitas
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onNavigateTab && (
            <>
              <button
                onClick={() => onNavigateTab('upload-master')}
                className="px-3.5 py-2 rounded-lg bg-emerald-600/10 border border-emerald-500/30 hover:bg-emerald-600/20 text-emerald-300 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Upload Opbal / Master</span>
              </button>
              <button
                onClick={() => onNavigateTab('ai-advisor')}
                className="px-3.5 py-2 rounded-lg bg-indigo-600/10 border border-indigo-500/30 hover:bg-indigo-600/20 text-indigo-300 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>AI Stock Advisor</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Total SKU */}
        <div className="bg-[#14161B] p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <p className="text-slate-500 text-xs uppercase font-semibold">Total SKU Terdaftar</p>
            <h3 className="text-3xl font-bold text-white mt-1">{analytics.totalSkus}</h3>
          </div>
          <p className="text-emerald-500 text-xs mt-3 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {formatNumber(analytics.totalUnits)} Total Unit Fisik
          </p>
        </div>

        {/* Card 2: Total Kubikasi All Stok (CBM) */}
        <div className="bg-[#14161B] p-5 rounded-xl border border-indigo-500/30 bg-gradient-to-br from-[#14161B] to-indigo-950/20 flex flex-col justify-between shadow-lg shadow-indigo-950/20">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-indigo-400 text-xs uppercase font-semibold flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-indigo-400" />
                Kubikasi All Stok
              </p>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold">
                CBM / m³
              </span>
            </div>
            <h3 className="text-3xl font-bold text-indigo-400 mt-1 font-mono">{formatCbm(analytics.totalCbm)}</h3>
          </div>
          <div className="text-slate-400 text-xs mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>Rata-rata: {formatCbm(analytics.totalCbm / (analytics.totalSkus || 1))} / SKU</span>
            <span className="text-emerald-400 font-semibold text-[11px]">Volumetrik Aktif</span>
          </div>
        </div>

        {/* Card 3: Kapasitas Terpakai (Space Occupancy Rate Global by CBM) */}
        <div className="bg-[#14161B] p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-slate-500 text-xs uppercase font-semibold">Global Space Occupancy</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                By CBM
              </span>
            </div>
            <h3 className="text-3xl font-bold text-slate-100 mt-1">{globalCbmOccupancyPct}%</h3>
          </div>
          <div className="text-slate-400 text-xs mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>{formatCbm(analytics.totalCbm)} / {formatCbm(totalNetworkMaxCbm)} m³</span>
            <span className="text-[10px] text-emerald-400 font-semibold">Sisa: {formatCbm(globalRemainingCbm)} m³</span>
          </div>
        </div>

        {/* Card 4: TOTAL GUDANG */}
        <div 
          onClick={() => setOccupancyViewMode('warehouse')}
          className="bg-[#14161B] p-5 rounded-xl border border-cyan-500/40 bg-gradient-to-br from-[#14161B] via-[#14161B] to-cyan-950/25 flex flex-col justify-between shadow-lg shadow-cyan-950/20 hover:border-cyan-400/60 transition-all cursor-pointer group"
        >
          <div>
            <div className="flex items-center justify-between">
              <p className="text-cyan-400 text-xs uppercase font-semibold flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                TOTAL GUDANG
              </p>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">
                {warehouseStats.length} Fasilitas
              </span>
            </div>
            
            <div className="mt-1 flex items-baseline justify-between">
              <div>
                <h3 className="text-2xl font-bold text-white font-mono">
                  {warehouseStats.length} <span className="text-xs font-normal text-slate-400 font-sans">Gudang Aktif</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {formatNumber(analytics.totalSkus)} Total SKU Jaringan
                </p>
              </div>
              <div className="text-right font-mono">
                <div className="text-sm font-bold text-cyan-300">
                  {formatNumber(analytics.totalUnits)} <span className="text-[10px] font-normal text-slate-400">Qty</span>
                </div>
                <div className="text-xs font-semibold text-indigo-300 mt-0.5">
                  {formatCbm(analytics.totalCbm)} <span className="text-[10px] font-normal text-slate-400">CBM</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-slate-400 text-xs mt-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-slate-400 font-medium">Occupancy Space per Gudang:</span>
              <span className="text-cyan-300 font-mono font-bold text-[10px] group-hover:underline flex items-center gap-0.5">
                Lihat Detail <ChevronRight className="w-3 h-3" />
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {warehouseStats.slice(0, 2).map((wh) => (
                <div key={wh.code} className="bg-[#0A0B0E]/90 px-2 py-1 rounded border border-slate-800 text-[10px]">
                  <div className="flex justify-between items-center font-mono">
                    <span className="text-slate-300 font-semibold truncate max-w-[65px]">{wh.code}</span>
                    <span className={`font-bold ${wh.cbmOccupancyPct > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {wh.cbmOccupancyPct}% Space
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-500 truncate mt-0.5">
                    {formatCbm(wh.totalCbm)} / {formatCbm(wh.maxCapacityCbm)} m³
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* REPLACED SECTION: DETAIL KETERANGAN FASILITAS GUDANG (ANALISA SPACE & KUBIKASI CBM) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-cyan-400" />
              Detail Keterangan Fasilitas Gudang (Analisa Space & Kubikasi CBM)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Utilisasi dan analisa ketersediaan space dihitung murni berdasarkan kubikasi (CBM / m³). Jumlah kuantitas (Qty) disajikan sebagai total akumulasi unit fisik.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#14161B] border border-slate-800 font-mono">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              Total Jaringan Qty: <strong className="text-white">{formatNumber(analytics.totalUnits)}</strong> Unit
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#14161B] border border-slate-800 font-mono text-indigo-300">
              <Boxes className="w-3.5 h-3.5 text-indigo-400" />
              Space Jaringan: <strong className="text-white">{formatCbm(analytics.totalCbm)} / {formatCbm(totalNetworkMaxCbm)} m³ ({globalCbmOccupancyPct}%)</strong>
            </span>
          </div>
        </div>

        {/* Multi-Warehouse Detail Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {warehouseStats.map((wh) => {
            const isHighOccupancy = wh.cbmOccupancyPct > 80;
            const isMediumOccupancy = wh.cbmOccupancyPct >= 50 && wh.cbmOccupancyPct <= 80;

            return (
              <div 
                key={wh.code}
                className="bg-[#14161B] border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md group"
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800/80">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${wh.badgeBg}`}>
                          {wh.code}
                        </span>
                        <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {wh.name}
                        </h4>
                      </div>
                      <p className="text-[11px] text-cyan-400/90 font-medium">
                        {wh.typeLabel}
                      </p>
                      <p className="text-[10px] text-slate-500 flex items-start gap-1 pt-0.5 line-clamp-1">
                        <MapPin className="w-3 h-3 text-slate-600 shrink-0 mt-0.5" />
                        {wh.locationNote}
                      </p>
                    </div>

                    <span className={`text-[11px] font-mono font-bold px-2 py-1 rounded shrink-0 border ${
                      isHighOccupancy 
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/30' 
                        : isMediumOccupancy
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                    }`}>
                      {wh.cbmOccupancyPct}% Space Terisi
                    </span>
                  </div>

                  {/* Primary Metrics Box: Qty & CBM */}
                  <div className="grid grid-cols-2 gap-3 bg-[#0A0B0E] p-3 rounded-lg border border-slate-800/90">
                    {/* Total Qty Box - Only as simple aggregate summary */}
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Total Kuantitas
                        </span>
                      </div>
                      <div className="text-lg font-mono font-bold text-cyan-300">
                        {formatNumber(wh.totalQty)} <span className="text-[11px] font-normal text-slate-400 font-sans">Unit</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        Porsi Stok: <strong className="text-slate-300">{wh.qtySharePct}%</strong>
                      </span>
                    </div>

                    {/* Total CBM Box - The basis for space analysis */}
                    <div className="space-y-0.5 border-l border-slate-800 pl-3">
                      <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider flex items-center gap-1">
                        <Boxes className="w-3 h-3 text-indigo-400" />
                        Kubikasi Terpakai
                      </span>
                      <div className="text-lg font-mono font-bold text-indigo-300">
                        {formatCbm(wh.totalCbm)} <span className="text-[10px] font-normal text-slate-400 font-sans">m³</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        Porsi Volume: <strong className="text-slate-300">{wh.cbmSharePct}%</strong>
                      </span>
                    </div>
                  </div>

                  {/* Space Capacity & Utilization Bar (Calculated strictly by CBM) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400 flex items-center gap-1 font-medium">
                        <span>Utilisasi Space (By CBM):</span>
                      </span>
                      <span className="font-mono text-slate-200">
                        <strong className="text-white">{formatCbm(wh.totalCbm)} m³</strong> / {formatCbm(wh.maxCapacityCbm)} m³ <span className="text-indigo-400 font-bold">({wh.cbmOccupancyPct}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isHighOccupancy 
                            ? 'bg-rose-500 shadow-sm shadow-rose-500/50' 
                            : isMediumOccupancy 
                            ? 'bg-amber-500 shadow-sm shadow-amber-500/50' 
                            : 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                        }`}
                        style={{ width: `${Math.min(100, wh.cbmOccupancyPct)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] pt-0.5">
                      <span className="text-emerald-400 font-semibold font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        Sisa Space: {formatCbm(wh.remainingCbm)} m³ Kosong
                      </span>
                      <span className="text-slate-400">
                        {wh.locatorsCount} Locator ({wh.occupiedLocatorsCount} Terisi)
                      </span>
                    </div>

                    {/* Space Status Banner */}
                    <div className={`mt-2 p-2 rounded-lg text-[10px] flex items-center justify-between border ${
                      isHighOccupancy 
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' 
                        : isMediumOccupancy 
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' 
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    }`}>
                      <span className="flex items-center gap-1 font-medium">
                        {isHighOccupancy ? '🚨 Ruang Kritis: Sisa CBM < 15%' : isMediumOccupancy ? '⚡ Utilisasi Ruang Optimal' : '✅ Space Sangat Luas & Siap Inbound'}
                      </span>
                      <span className="font-mono font-bold">
                        Kapasitas: {formatCbm(wh.maxCapacityCbm)} m³
                      </span>
                    </div>
                  </div>

                  {/* Categories Breakdown Chips */}
                  {wh.categoriesSummary.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                        Kategori Tersimpan:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {wh.categoriesSummary.slice(0, 3).map((c, i) => (
                          <span 
                            key={i} 
                            className="px-2 py-0.5 bg-[#0A0B0E] border border-slate-800 rounded text-[10px] text-slate-300 font-medium flex items-center gap-1"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                            <span className="truncate max-w-[90px]">{c.category}</span>
                            <span className="text-indigo-300 font-mono">({formatCbm(c.cbm)})</span>
                          </span>
                        ))}
                        {wh.categoriesSummary.length > 3 && (
                          <span className="px-1.5 py-0.5 bg-[#0A0B0E] border border-slate-800 rounded text-[10px] text-slate-500">
                            +{wh.categoriesSummary.length - 3} lainnya
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                    <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <strong>{wh.items.length}</strong> SKU • <strong>{formatNumber(wh.totalQty)}</strong> Unit
                  </span>

                  <button
                    onClick={() => setSelectedWarehouseForDetail(wh)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat Detail SKU & CBM</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Split Section: Table + Side widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Recent Movements Table */}
        <div className="lg:col-span-2 bg-[#14161B] rounded-xl border border-slate-800 flex flex-col overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center">
            <h4 className="font-bold text-white uppercase text-xs tracking-widest">
              Recent Inventory Items & Locator
            </h4>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('inventory')}
                className="text-indigo-400 text-xs hover:underline cursor-pointer"
              >
                View Full Inventory →
              </button>
            )}
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-900/50 text-slate-500 uppercase text-[10px] font-bold sticky top-0">
                <tr>
                  <th className="px-4 py-3.5">SKU ID</th>
                  <th className="px-4 py-3.5">Product Name</th>
                  <th className="px-4 py-3.5">Locator</th>
                  <th className="px-4 py-3.5 text-center">Stock</th>
                  <th className="px-4 py-3.5 text-right">Kubikasi (CBM)</th>
                  <th className="px-4 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {items.slice(0, 6).map((item) => {
                  const isLow = item.status === 'LOW_STOCK';
                  const isOut = item.status === 'OUT_OF_STOCK';
                  const totalItemCbm = item.stock * (item.cbmPerUnit || 0);
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-indigo-400 font-medium">
                        {item.sku}
                      </td>
                      <td className="px-4 py-3 text-white font-medium truncate max-w-[180px]">
                        {item.name}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            locateSku(item.sku);
                            if (onNavigateTab) onNavigateTab('locator');
                          }}
                          className="bg-[#0A0B0E] px-2.5 py-1 rounded text-xs border border-slate-800 text-emerald-400 font-mono hover:border-slate-700 transition-colors cursor-pointer"
                        >
                          {item.location.fullCode}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-white">
                        {formatNumber(item.stock)} <span className="text-[10px] text-slate-500 font-normal">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-indigo-300 font-semibold">
                        {formatCbm(totalItemCbm)}
                        <span className="block text-[10px] text-slate-500 font-normal font-sans">
                          {item.cbmPerUnit ? `${formatCbmValue(item.cbmPerUnit)} m³/u` : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOut ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                          />
                          <span className="text-slate-300 text-[11px]">
                            {isOut ? 'Out of Stock' : isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Smart Scanner Widget & Trends */}
        <div className="flex flex-col gap-6">
          
          {/* Smart Scanner Highlight Card */}
          <div className="bg-indigo-600 rounded-xl p-5 text-white flex flex-col justify-between h-48 shadow-lg">
            <div>
              <h4 className="font-bold uppercase text-[10px] tracking-widest mb-1 opacity-80">
                Smart Scanner
              </h4>
              <p className="text-base sm:text-lg font-semibold leading-snug">
                Scan SKU to verify locator details & update stock instantly.
              </p>
            </div>
            <button
              onClick={() => setIsScannerOpen(true)}
              className="w-full bg-white text-indigo-600 hover:bg-slate-100 font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
            >
              <ScanLine className="w-4 h-4" /> Start Scanning
            </button>
          </div>

          {/* Inbound Volume Trends Chart */}
          <div className="bg-[#14161B] border border-slate-800 rounded-xl p-5 flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white uppercase text-[10px] tracking-widest">
                Inbound Volume Trends
              </h4>
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                <span>7 Hari</span>
              </div>
            </div>

            <div className="h-32 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={movementTrendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E222B" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#14161B', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="masuk" stroke="#6366f1" strokeWidth={2} fill="url(#colorTrend)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800">
              <span>Avg: 198 Unit/Hari</span>
              <span className="text-emerald-400 font-semibold">+14% vs Pekan Lalu</span>
            </div>
          </div>

        </div>

      </div>

      {/* Bottom Row: Multi-Warehouse Occupancy / Zone Matrix & Category Share */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Multi-Warehouse Occupancy & Capacity Matrix */}
        <div className="bg-[#14161B] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-800/80">
            <div>
              <h4 className="font-bold text-white uppercase text-xs tracking-widest flex items-center gap-2">
                {occupancyViewMode === 'warehouse' ? (
                  <Building2 className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Layers className="w-4 h-4 text-indigo-400" />
                )}
                {occupancyViewMode === 'warehouse'
                  ? 'Occupancy & Volume Multi-Gudang'
                  : 'Utilisasi Kapasitas Rak per Zona'}
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {occupancyViewMode === 'warehouse'
                  ? 'Perhitungan Space Occupancy berbasis CBM (Kubikasi m³) dan Total Qty'
                  : 'Alokasi stok dan utilisasi rak pada Zona A, B, C, D'}
              </p>
            </div>

            {/* View Mode Toggle Switcher */}
            <div className="flex items-center bg-[#0A0B0E] p-1 rounded-lg border border-slate-800 shrink-0 self-start sm:self-auto">
              <button
                onClick={() => setOccupancyViewMode('warehouse')}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  occupancyViewMode === 'warehouse'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Per Gudang</span>
              </button>
              <button
                onClick={() => setOccupancyViewMode('zone')}
                className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  occupancyViewMode === 'zone'
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Per Zona</span>
              </button>
            </div>
          </div>

          {occupancyViewMode === 'warehouse' ? (
            /* Multi-Warehouse Occupancy Cards */
            <div className="space-y-3 pt-1">
              {warehouseStats.map((wh) => (
                <div
                  key={wh.code}
                  className="p-3.5 rounded-xl bg-[#0A0B0E] border border-slate-800/90 hover:border-slate-700 transition-all space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${wh.badgeBg}`}>
                        {wh.code}
                      </span>
                      <div>
                        <h5 className="text-xs font-bold text-white">{wh.name}</h5>
                        <p className="text-[10px] text-slate-500">{wh.locationNote}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-cyan-300">
                          {formatNumber(wh.totalQty)} <span className="text-[10px] font-normal text-slate-400">Qty</span>
                        </div>
                        <div className="text-[11px] font-mono text-indigo-300">
                          {formatCbm(wh.totalCbm)} <span className="text-[10px] font-normal text-slate-400">CBM</span>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                          wh.cbmOccupancyPct > 85
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : wh.cbmOccupancyPct > 60
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {wh.cbmOccupancyPct}% Space
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          wh.cbmOccupancyPct > 85 ? 'bg-rose-500' : wh.cbmOccupancyPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, wh.cbmOccupancyPct)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>Sisa Ruang: <strong className="text-emerald-400">{formatCbm(wh.remainingCbm)} m³</strong> • {wh.totalSkus} SKU</span>
                      <span>Kapasitas: {formatCbm(wh.totalCbm)} / {formatCbm(wh.maxCapacityCbm)} m³</span>
                    </div>
                  </div>

                  {/* Action Link to inspect SKUs in this warehouse */}
                  <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">
                      Space Status: {wh.cbmOccupancyPct >= 85 ? 'Mendekati Penuh (<15% Sisa CBM)' : wh.cbmOccupancyPct >= 50 ? 'Optimal & Terkendali' : 'Kapasitas Longgar'}
                    </span>
                    <button
                      onClick={() => setSelectedWarehouseForDetail(wh)}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Rincian SKU ({wh.items.length})</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Zone Capacity Utilization */
            <div className="space-y-3 pt-1">
              {zoneStats.map((z) => (
                <div key={z.id} className="p-3 rounded-lg bg-[#0A0B0E] border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="font-medium text-white">{z.name}</span>
                      <span className="ml-2 text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                        {formatCbm(z.cbm)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-slate-400">{z.current} / {z.max} Unit</span>
                      <span className={`font-bold ${z.pct > 85 ? 'text-rose-400' : z.pct > 60 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        ({z.pct}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        z.pct > 85 ? 'bg-rose-500' : z.pct > 60 ? 'bg-amber-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(100, z.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Breakdown & Volume Share */}
        <div className="bg-[#14161B] border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-white uppercase text-xs tracking-widest flex items-center gap-2">
              <Boxes className="w-4 h-4 text-indigo-400" />
              Distribusi Kategori & Kubikasi
            </h4>
            <span className="text-[11px] text-slate-500">Unit & Volume (m³)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#14161B', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(value: any, name: any, item: any) => [
                      `${value} Unit (${formatCbm(item.payload.cbm)})`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 text-xs">
              {categoryData.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="truncate max-w-[110px]">{cat.name}</span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-bold text-slate-200">{cat.value} u</span>
                    <span className="text-[10px] text-indigo-300 ml-1.5">({formatCbm(cat.cbm)})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-between text-[11px] text-slate-500">
            <span>Total Kategori: 5 Sektor</span>
            <span className="text-indigo-400">Rotasi Tercepat: FMCG & IT</span>
          </div>
        </div>

      </div>

      {/* Warehouse SKU Breakdown Modal */}
      {selectedWarehouseForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#14161B] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded text-xs font-mono font-bold">
                      {selectedWarehouseForDetail.code}
                    </span>
                    <h3 className="text-base font-bold text-white">
                      {selectedWarehouseForDetail.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedWarehouseForDetail.locationNote}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedWarehouseForDetail(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warehouse Quick Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-[#0A0B0E] border-b border-slate-800/80">
              <div className="p-2.5 rounded-lg bg-[#14161B] border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Kuantitas</span>
                <span className="text-base font-mono font-bold text-cyan-400">
                  {formatNumber(selectedWarehouseForDetail.totalQty)} <span className="text-xs font-normal text-slate-400">Unit</span>
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Total Fisik ({selectedWarehouseForDetail.qtySharePct}%)</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#14161B] border border-slate-800">
                <span className="text-[10px] text-indigo-400 uppercase font-semibold block">Kubikasi Terpakai</span>
                <span className="text-base font-mono font-bold text-indigo-300">
                  {formatCbm(selectedWarehouseForDetail.totalCbm)} <span className="text-xs font-normal text-slate-400">m³</span>
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Volume ({selectedWarehouseForDetail.cbmSharePct}%)</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#14161B] border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Space Occupancy</span>
                <span className={`text-base font-mono font-bold ${selectedWarehouseForDetail.cbmOccupancyPct > 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {selectedWarehouseForDetail.cbmOccupancyPct}%
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Dihitung By CBM</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#14161B] border border-slate-800">
                <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Sisa Space CBM</span>
                <span className="text-base font-mono font-bold text-emerald-400">
                  {formatCbm(selectedWarehouseForDetail.remainingCbm)} <span className="text-xs font-normal text-slate-400">m³</span>
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Max: {formatCbm(selectedWarehouseForDetail.maxCapacityCbm)} m³</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#14161B] border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Jumlah SKU</span>
                <span className="text-base font-mono font-bold text-white">
                  {selectedWarehouseForDetail.items.length} <span className="text-xs font-normal text-slate-400">SKU</span>
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">{selectedWarehouseForDetail.locatorsCount} Locator</span>
              </div>
            </div>

            {/* Filter Search within Modal */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Cari SKU, Nama Produk, atau Locator di gudang ini..."
                  value={warehouseSearchQuery}
                  onChange={(e) => setWarehouseSearchQuery(e.target.value)}
                  className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* SKU Table within Warehouse */}
            <div className="flex-1 overflow-y-auto p-4">
              {selectedWarehouseForDetail.items.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  Belum ada item SKU yang terdaftar di fasilitas {selectedWarehouseForDetail.code}.
                </div>
              ) : (
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold sticky top-0">
                    <tr>
                      <th className="px-3.5 py-2.5 rounded-l">SKU</th>
                      <th className="px-3.5 py-2.5">Nama Produk</th>
                      <th className="px-3.5 py-2.5">Kategori</th>
                      <th className="px-3.5 py-2.5">Locator</th>
                      <th className="px-3.5 py-2.5 text-center">Stok</th>
                      <th className="px-3.5 py-2.5 text-right">CBM Total</th>
                      <th className="px-3.5 py-2.5 rounded-r text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-slate-300">
                    {selectedWarehouseForDetail.items
                      .filter((item) => {
                        const q = warehouseSearchQuery.toLowerCase();
                        return (
                          !q ||
                          item.sku.toLowerCase().includes(q) ||
                          item.name.toLowerCase().includes(q) ||
                          item.location.fullCode.toLowerCase().includes(q) ||
                          item.category.toLowerCase().includes(q)
                        );
                      })
                      .map((item) => {
                        const itemCbm = item.stock * (item.cbmPerUnit || 0);
                        return (
                          <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-3.5 py-2.5 font-mono text-cyan-400 font-semibold">
                              {item.sku}
                            </td>
                            <td className="px-3.5 py-2.5 text-white font-medium">
                              {item.name}
                            </td>
                            <td className="px-3.5 py-2.5 text-slate-400 text-[11px]">
                              {item.category}
                            </td>
                            <td className="px-3.5 py-2.5">
                              <span className="bg-[#0A0B0E] px-2 py-0.5 rounded text-[11px] border border-slate-800 text-emerald-400 font-mono">
                                {item.location.fullCode}
                              </span>
                            </td>
                            <td className="px-3.5 py-2.5 text-center font-mono font-bold text-white">
                              {formatNumber(item.stock)} <span className="text-[10px] text-slate-500 font-normal">{item.unit}</span>
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono text-indigo-300 font-semibold">
                              {formatCbm(itemCbm)}
                            </td>
                            <td className="px-3.5 py-2.5 text-center">
                              <button
                                onClick={() => {
                                  locateSku(item.sku);
                                  setSelectedWarehouseForDetail(null);
                                  if (onNavigateTab) onNavigateTab('locator');
                                }}
                                className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 text-[10px] font-semibold cursor-pointer"
                              >
                                Lacak Locator
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-900/50 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setSelectedWarehouseForDetail(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
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
