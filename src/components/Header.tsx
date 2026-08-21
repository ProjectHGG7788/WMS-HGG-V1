import React, { useState, useEffect } from 'react';
import { 
  ScanLine, 
  Search, 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  AlertTriangle, 
  Warehouse,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInventory } from '../context/InventoryContext';

interface HeaderProps {
  onSearchSelectSku?: (sku: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onSearchSelectSku, onNavigateTab }) => {
  const { currentUser, setIsLoginModalOpen } = useAuth();
  const { cloudSyncStatus, refreshData, items, setIsScannerOpen, locateSku, analytics } = useInventory();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const searchResults = searchQuery.trim()
    ? items.filter(
        (item) =>
          item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.barcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.location.fullCode.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const handleSelectSearchResult = (sku: string) => {
    locateSku(sku);
    setSearchQuery('');
    setIsSearchOpen(false);
    if (onSearchSelectSku) onSearchSelectSku(sku);
    if (onNavigateTab) onNavigateTab('locator');
  };

  return (
    <header className="bg-[#14161B] border-b border-slate-800 sticky top-0 z-30 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white shadow-sm shrink-0">
            <Warehouse className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-base text-white tracking-tight">WMS NEXUS</span>
              <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] uppercase tracking-wider font-bold text-slate-400">
                Enterprise
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Sistem Manajemen Inventaris & SKU Locator Real-time
            </p>
          </div>
        </div>

        {/* Center: Global Search SKU / Barcode */}
        <div className="relative flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari SKU, Barcode, Nama Produk, atau Rak..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg pl-10 pr-10 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Dropdown Results */}
          {isSearchOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#14161B] border border-slate-800 rounded-xl shadow-2xl p-1.5 z-50 divide-y divide-slate-800">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-1">
                Hasil Pencarian SKU ({searchResults.length})
              </div>
              {searchResults.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectSearchResult(item.sku)}
                  className="px-3 py-2 hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded bg-[#0A0B0E] border border-slate-800 flex items-center justify-center text-xs font-mono font-bold text-indigo-400">
                      {item.location.zoneId}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-200 group-hover:text-white flex items-center gap-2">
                        {item.name}
                        <span className="font-mono text-[11px] text-indigo-400 bg-indigo-600/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                          {item.sku}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>Barcode: <span className="font-mono text-slate-400">{item.barcode}</span></span>
                        <span>•</span>
                        <span>Lokasi: <span className="font-mono text-emerald-400">{item.location.fullCode}</span></span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-white">
                      {item.stock} {item.unit}
                    </div>
                    <span className="text-[10px] text-indigo-400 font-medium group-hover:underline">
                      Lihat Locator →
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Action Icons & User Role Selector */}
        <div className="flex items-center gap-2 sm:gap-4">
          
          {/* Quick Scanner Button */}
          <button
            onClick={() => setIsScannerOpen(true)}
            id="btn-quick-scanner"
            className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-xs shadow-sm transition-all cursor-pointer"
            title="Buka Kamera Pemindai Barcode / QR"
          >
            <ScanLine className="w-4 h-4" />
            <span className="hidden sm:inline">Pindai Barcode</span>
          </button>

          {/* Cloud Sync Indicator */}
          <div 
            onClick={() => refreshData()}
            className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0A0B0E] border border-slate-800 text-xs text-slate-400 cursor-pointer hover:border-slate-700 transition-colors"
            title="Klik untuk sinkronisasi ulang data cloud"
          >
            {cloudSyncStatus === 'synced' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[11px] text-emerald-400 font-medium">Cloud Aktif</span>
              </>
            ) : cloudSyncStatus === 'syncing' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                <span className="text-[11px] text-indigo-400 font-medium">Sinkronisasi...</span>
              </>
            ) : (
              <>
                <CloudOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] text-amber-400 font-medium">Offline</span>
              </>
            )}
          </div>

          {/* Low Stock Notification Badge */}
          {analytics.lowStockCount > 0 && (
            <button 
              onClick={() => onNavigateTab && onNavigateTab('inventory')}
              className="relative p-2 rounded-lg bg-[#0A0B0E] border border-slate-800 hover:border-slate-700 text-amber-400 transition-colors cursor-pointer"
              title={`${analytics.lowStockCount} barang membutuhkan restock`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center">
                {analytics.lowStockCount}
              </span>
            </button>
          )}

          {/* User Profile & Role Switcher */}
          <button
            onClick={() => setIsLoginModalOpen(true)}
            id="btn-user-role-menu"
            className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-lg bg-[#0A0B0E] hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all text-left group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-medium text-white flex items-center gap-1">
                {currentUser.name}
                <ChevronDown className="w-3 h-3 text-slate-500" />
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                {currentUser.role === 'manager' ? 'Super User' : currentUser.role === 'operator' ? 'Operator' : currentUser.role === 'auditor' ? 'Auditor QC' : 'Viewer'}
              </div>
            </div>
          </button>
        </div>

      </div>
    </header>
  );
};
