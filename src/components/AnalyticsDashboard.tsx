import React, { useState } from 'react';
import { 
  Boxes, 
  TrendingUp, 
  Layers, 
  AlertTriangle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Activity, 
  Sparkles,
  ScanLine,
  MapPin,
  Truck,
  RotateCcw,
  ArrowRight,
  FileSpreadsheet
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
import { formatNumber, formatCbm } from '../utils/formatters';

export const AnalyticsDashboard: React.FC<{ onNavigateTab?: (tab: string) => void }> = ({ onNavigateTab }) => {
  const { items, zones, transactions, analytics, locateSku, setIsScannerOpen } = useInventory();
  const { currentUser } = useAuth();
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');

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
            Monitoring operasional, perputaran stok, kubikasi volume (CBM), dan utilisasi kapasitas rak
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

      {/* 4 Metric Cards as in Elegant Dark Theme */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total SKU */}
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

        {/* Total Kubikasi All Stok (CBM) - Key user requested feature */}
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
            <span>Rata-rata: {(analytics.totalCbm / (analytics.totalSkus || 1)).toFixed(3)} m³/SKU</span>
            <span className="text-emerald-400 font-semibold text-[11px]">Volumetrik Aktif</span>
          </div>
        </div>

        {/* Kapasitas Terpakai (Occupancy Rate) */}
        <div className="bg-[#14161B] p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <p className="text-slate-500 text-xs uppercase font-semibold">Occupancy Rate</p>
            <h3 className="text-3xl font-bold text-slate-100 mt-1">{analytics.occupancyRatePct}%</h3>
          </div>
          <p className="text-slate-400 text-xs mt-3 flex items-center justify-between">
            <span>{formatNumber(analytics.totalUnits)} / {formatNumber(analytics.totalCapacityUnits)} Unit</span>
            <span className="text-[10px] text-indigo-400 font-semibold">Kapasitas Rak</span>
          </p>
        </div>

        {/* Out of Stock / Alert */}
        <div className="bg-[#14161B] p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div>
            <p className="text-slate-500 text-xs uppercase font-semibold">Status Stok Menipis</p>
            <h3 className="text-3xl font-bold text-rose-500 mt-1">{analytics.outOfStockCount}</h3>
          </div>
          <p className="text-slate-500 text-xs mt-3">
            {analytics.lowStockCount > 0 ? `${analytics.lowStockCount} SKU Perlu Reorder` : 'Semua Stok Tercukupi'}
          </p>
        </div>

      </div>

      {/* Operasional Transaksi Quick Launcher Cards */}
      {onNavigateTab && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Inbound Launcher */}
          <div
            onClick={() => onNavigateTab('inbound')}
            className="p-4 rounded-xl bg-gradient-to-br from-[#14161B] to-emerald-950/20 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group flex items-start justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                    Menu Inbound (Masuk)
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-medium">Penerimaan Barang</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">
                Penerimaan vendor lokal, kontainer impor, dan transfer barang antar cabang afiliasi.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all mt-1 shrink-0" />
          </div>

          {/* Outbound Launcher */}
          <div
            onClick={() => onNavigateTab('outbound')}
            className="p-4 rounded-xl bg-gradient-to-br from-[#14161B] to-indigo-950/20 border border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer group flex items-start justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                    Menu Outbound (Keluar)
                  </h4>
                  <span className="text-[10px] text-indigo-400 font-medium">Pengeluaran & Picking</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">
                Order customer reguler, konsinyasi retail, barang pameran/event & retur vendor.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all mt-1 shrink-0" />
          </div>

          {/* Return Launcher */}
          <div
            onClick={() => onNavigateTab('return')}
            className="p-4 rounded-xl bg-gradient-to-br from-[#14161B] to-rose-950/20 border border-slate-800 hover:border-rose-500/50 transition-all cursor-pointer group flex items-start justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 group-hover:scale-105 transition-transform">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-rose-300 transition-colors">
                    Menu Return (Retur & QC)
                  </h4>
                  <span className="text-[10px] text-rose-400 font-medium">Pemeriksaan Kualitas</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 line-clamp-2">
                Retur klaim garansi customer, penarikan konsinyasi & pameran dengan grading QC.
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-rose-400 group-hover:translate-x-1 transition-all mt-1 shrink-0" />
          </div>
        </div>
      )}

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
                        {item.stock} <span className="text-[10px] text-slate-500 font-normal">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-indigo-300 font-semibold">
                        {formatCbm(totalItemCbm)}
                        <span className="block text-[10px] text-slate-500 font-normal font-sans">
                          {item.cbmPerUnit ? `${item.cbmPerUnit} m³/u` : '-'}
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

      {/* Bottom Row: Zone Capacity & Category Share */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Zone Capacity Utilization */}
        <div className="bg-[#14161B] border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-white uppercase text-xs tracking-widest flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              Utilisasi Kapasitas Rak per Zona
            </h4>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('locator')}
                className="text-xs text-indigo-400 hover:underline cursor-pointer"
              >
                Peta Rak 2D →
              </button>
            )}
          </div>

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
        </div>

        {/* Category Breakdown */}
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

    </div>
  );
};
