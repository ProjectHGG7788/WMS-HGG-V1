import React, { useState } from 'react';
import { 
  X, 
  ShieldCheck, 
  UserCheck, 
  KeyRound, 
  ScanLine, 
  ClipboardCheck, 
  Eye, 
  Check, 
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { USER_PROFILES } from '../data/mockWarehouse';

export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, setIsLoginModalOpen, currentUser, loginWithRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentUser.role);
  const [customName, setCustomName] = useState('');

  if (!isLoginModalOpen) return null;

  const rolesList: {
    role: UserRole;
    title: string;
    description: string;
    icon: any;
    color: string;
    profile: typeof USER_PROFILES.manager;
    permissionsSummary: string[];
  }[] = [
    {
      role: 'manager',
      title: 'Kepala Gudang (Warehouse Manager)',
      description: 'Akses penuh seluruh modul, approval penyesuaian stok opname, konfigurasi rak & pengguna.',
      icon: ShieldCheck,
      color: 'emerald',
      profile: USER_PROFILES.manager,
      permissionsSummary: ['Kelola Inbound/Outbound', 'Approve Stock Opname', 'Konfigurasi Rak', 'AI Optimizer'],
    },
    {
      role: 'operator',
      title: 'Staff Operasional & Barcode Scanner',
      description: 'Fokus eksekusi harian: scan barcode, barang masuk (putaway), barang keluar (picking), relokasi rak.',
      icon: ScanLine,
      color: 'blue',
      profile: USER_PROFILES.operator,
      permissionsSummary: ['Scan Barcode Kamera', 'Eksekusi Inbound/Outbound', 'Transfer Antar Rak', 'Cek SKU Locator'],
    },
    {
      role: 'auditor',
      title: 'Staff QC & Auditor Stock Opname',
      description: 'Pemeriksaan fisik stok, verifikasi selisih, input hasil hitung barcode opname, dan laporan QC.',
      icon: ClipboardCheck,
      color: 'amber',
      profile: USER_PROFILES.auditor,
      permissionsSummary: ['Input Stock Opname Fisik', 'Analisis Selisih / Varians', 'Ekspor Laporan Audit', 'AI Risk Detection'],
    },
    {
      role: 'viewer',
      title: 'Direksi / Manajemen (Executive Viewer)',
      description: 'Monitoring dashboard analitik, perputaran barang (turnover rate), valuasi total aset, mode read-only.',
      icon: Eye,
      color: 'purple',
      profile: USER_PROFILES.viewer,
      permissionsSummary: ['Dashboard Analitik', 'Laporan Valuasi Aset', 'Tren Fast/Slow Moving', 'Ekspor Laporan'],
    },
  ];

  const handleApplyLogin = (role: UserRole) => {
    loginWithRole(role, customName.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#14161B] border border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-[#0A0B0E]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Pilih Role Pengguna & Hak Akses</h2>
              <p className="text-xs text-slate-400">
                Sistem Role-Based Access Control (RBAC) berbasis Cloud
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsLoginModalOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Role Cards */}
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <div className="text-xs text-slate-400 font-medium">
            Pilih salah satu profil peran di bawah untuk berganti mode operasional:
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rolesList.map((item) => {
              const Icon = item.icon;
              const isCurrent = currentUser.role === item.role;
              const isSelected = selectedRole === item.role;

              return (
                <div
                  key={item.role}
                  onClick={() => setSelectedRole(item.role)}
                  className={`p-4 rounded-lg border transition-all cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-600/10 border-indigo-500 shadow-md'
                      : 'bg-[#0A0B0E] border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={item.profile.avatar}
                          alt={item.profile.name}
                          className="w-9 h-9 rounded-lg object-cover border border-slate-700"
                        />
                        <div>
                          <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                            {item.profile.name}
                            {isCurrent && (
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.2 rounded font-medium">
                                Aktif
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium line-clamp-1">
                            {item.title}
                          </div>
                        </div>
                      </div>
                      <div className={`p-1.5 rounded-lg ${
                        item.role === 'manager' ? 'bg-emerald-500/10 text-emerald-400' :
                        item.role === 'operator' ? 'bg-indigo-500/10 text-indigo-400' :
                        item.role === 'auditor' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-purple-500/10 text-purple-400'
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
                      Hak Akses Utama:
                    </div>
                    <div className="grid grid-cols-2 gap-1 mb-3">
                      {item.permissionsSummary.map((perm, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                          <Check className="w-3 h-3 text-indigo-400 shrink-0" />
                          <span className="truncate">{perm}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplyLogin(item.role);
                      }}
                      className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-slate-800 text-slate-400 cursor-default'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
                      }`}
                    >
                      {isCurrent ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Sedang Digunakan
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" /> Masuk Sebagai {item.role === 'manager' ? 'Kepala Gudang' : item.role === 'operator' ? 'Staff Barcode' : item.role === 'auditor' ? 'Auditor QC' : 'Viewer'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Optional Custom Operator Name Input */}
          <div className="pt-3 border-t border-slate-800 flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Ganti Nama Pengguna Sesi Ini (Opsional):
              </label>
              <input
                type="text"
                placeholder={USER_PROFILES[selectedRole]?.name}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full bg-[#0A0B0E] border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={() => handleApplyLogin(selectedRole)}
              className="mt-5 px-4 py-2 bg-[#0A0B0E] hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg border border-slate-800 transition-colors cursor-pointer"
            >
              Terapkan Perubahan
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-4 bg-[#0A0B0E] border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Enkripsi Token Sesi Cloud Aktif</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">WMS-RBAC v2.4.0</span>
        </div>
      </div>
    </div>
  );
};
