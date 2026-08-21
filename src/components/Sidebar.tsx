import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  MapPin,
  ScanLine,
  ArrowLeftRight,
  ClipboardCheck,
  Sparkles,
  Shield,
  Layers,
  ArrowDownLeft,
  Truck,
  RotateCcw,
  FileSpreadsheet
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const { currentUser } = useAuth();
  const { analytics, transactions } = useInventory();

  // Count active today / total by type
  const inboundCount = transactions.filter(t => t.type === 'INBOUND').length;
  const outboundCount = transactions.filter(t => t.type === 'OUTBOUND').length;
  const returnCount = transactions.filter(t => t.type === 'RETURN').length;
  const movementCount = transactions.filter(t => t.type === 'MOVEMENT' || t.type === 'TRANSFER').length;

  const mainNavItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null,
      visible: true,
    },
    {
      id: 'upload-master',
      label: 'Upload Master & Opbal',
      icon: FileSpreadsheet,
      badge: 'Excel',
      visible: true,
    },
    {
      id: 'inventory',
      label: 'Stok Barang (SKU)',
      icon: Boxes,
      badge: analytics.totalSkus ? `${analytics.totalSkus}` : null,
      visible: true,
    },
    {
      id: 'locator',
      label: 'SKU Locator (Rak)',
      icon: MapPin,
      badge: null,
      visible: true,
    },
    {
      id: 'scanner',
      label: 'Scan Barcode',
      icon: ScanLine,
      badge: 'Live',
      visible: true,
    },
  ];

  const transactionNavItems = [
    {
      id: 'inbound',
      label: 'Inbound (Masuk)',
      icon: ArrowDownLeft,
      badge: inboundCount > 0 ? `${inboundCount}` : 'New',
      badgeColor: 'emerald',
      visible: currentUser.permissions.canInbound,
    },
    {
      id: 'outbound',
      label: 'Outbound (Keluar)',
      icon: Truck,
      badge: outboundCount > 0 ? `${outboundCount}` : 'New',
      badgeColor: 'indigo',
      visible: currentUser.permissions.canOutbound,
    },
    {
      id: 'movement',
      label: 'Movement (Pindah Rak)',
      icon: ArrowLeftRight,
      badge: movementCount > 0 ? `${movementCount}` : 'New',
      badgeColor: 'cyan',
      visible: currentUser.permissions.canTransfer || true,
    },
    {
      id: 'return',
      label: 'Return (Retur QC)',
      icon: RotateCcw,
      badge: returnCount > 0 ? `${returnCount}` : 'New',
      badgeColor: 'rose',
      visible: currentUser.permissions.canReturn,
    },
    {
      id: 'transactions',
      label: 'Log Mutasi & Riwayat',
      icon: Layers,
      badge: null,
      badgeColor: 'slate',
      visible: true,
    },
  ];

  const auditNavItems = [
    {
      id: 'opname',
      label: 'Stock Opname',
      icon: ClipboardCheck,
      badge: currentUser.role === 'auditor' ? 'Audit' : null,
      badgeColor: 'amber',
      visible: currentUser.permissions.canOpname,
    },
    {
      id: 'ai-advisor',
      label: 'AI Intelligence',
      icon: Sparkles,
      badge: 'Gemini',
      badgeColor: 'purple',
      visible: true,
    },
  ];

  return (
    <aside className="w-full md:w-64 bg-[#14161B] border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between shrink-0">
      <div className="p-4 space-y-4 overflow-y-auto">
        
        {/* User Role Quick Info */}
        <div className="p-3 bg-[#0A0B0E] rounded-lg border border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Peran Pengguna
            </div>
            <div className="text-xs font-semibold text-white truncate">
              {currentUser.roleTitle}
            </div>
          </div>
        </div>

        {/* Navigation Section 1: Utama */}
        <nav className="space-y-1">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider px-3 mb-1.5">
            Inventaris & Lokasi
          </div>
          {mainNavItems.filter(i => i.visible).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                id={`nav-item-${item.id}`}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-500 rounded-r-md font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-indigo-400' : 'opacity-60 text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${
                      isActive
                        ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Navigation Section 2: Transaksi Operasional Gudang */}
        <nav className="space-y-1 pt-2 border-t border-slate-800/60">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider px-3 mb-1.5 flex items-center justify-between">
            <span>Operasi Transaksi</span>
            <span className="text-[9px] text-indigo-400 font-normal">Real-time</span>
          </div>
          {transactionNavItems.filter(i => i.visible).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                id={`nav-item-${item.id}`}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-500 rounded-r-md font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive
                        ? 'text-indigo-400'
                        : item.id === 'inbound'
                        ? 'text-emerald-400'
                        : item.id === 'outbound'
                        ? 'text-indigo-400'
                        : item.id === 'movement'
                        ? 'text-cyan-400'
                        : item.id === 'return'
                        ? 'text-rose-400'
                        : 'opacity-60 text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${
                      item.badgeColor === 'emerald'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : item.badgeColor === 'cyan'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                        : item.badgeColor === 'rose'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : isActive
                        ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Navigation Section 3: Audit & Analitik AI */}
        <nav className="space-y-1 pt-2 border-t border-slate-800/60">
          <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider px-3 mb-1.5">
            Kontrol & AI Advisor
          </div>
          {auditNavItems.filter(i => i.visible).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                id={`nav-item-${item.id}`}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-left text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-500 rounded-r-md font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-indigo-400' : 'opacity-60 text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${
                      item.badgeColor === 'purple'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        : isActive
                        ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

      </div>

      {/* Warehouse Okupansi Rak at Bottom */}
      <div className="p-4 mt-auto">
        <div className="p-3.5 bg-slate-800/40 rounded-lg border border-slate-800 text-xs space-y-2">
          <div className="flex justify-between items-center text-slate-400">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              Okupansi Rak
            </span>
            <span className="font-mono font-bold text-white text-[11px]">
              {analytics.occupancyPercentage}%
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                analytics.occupancyPercentage > 85
                  ? 'bg-rose-500'
                  : analytics.occupancyPercentage > 65
                  ? 'bg-amber-500'
                  : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.min(100, analytics.occupancyPercentage)}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-500 flex justify-between">
            <span>{analytics.totalStockUnits} Unit Aktif</span>
            <span>Kapasitas: 10.000</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
