import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { USER_PROFILES } from '../data/mockWarehouse';

interface AuthContextType {
  currentUser: UserProfile;
  activeRole: UserRole;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  switchRole: (role: UserRole) => void;
  loginWithRole: (role: UserRole, customName?: string) => void;
  logout: () => void;
  hasPermission: (permissionKey: keyof UserProfile['permissions']) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('wms_active_role');
    return (saved as UserRole) || 'manager';
  });

  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    return USER_PROFILES[activeRole] || USER_PROFILES.manager;
  });

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (USER_PROFILES[activeRole]) {
      setCurrentUser(USER_PROFILES[activeRole]);
      localStorage.setItem('wms_active_role', activeRole);
    }
  }, [activeRole]);

  const switchRole = (role: UserRole) => {
    if (USER_PROFILES[role]) {
      setActiveRole(role);
      setCurrentUser(USER_PROFILES[role]);
      localStorage.setItem('wms_active_role', role);
    }
  };

  const loginWithRole = (role: UserRole, customName?: string) => {
    if (USER_PROFILES[role]) {
      setActiveRole(role);
      const profile = { ...USER_PROFILES[role] };
      if (customName) {
        profile.name = customName;
      }
      setCurrentUser(profile);
      localStorage.setItem('wms_active_role', role);
      setIsLoginModalOpen(false);
    }
  };

  const logout = () => {
    setIsLoginModalOpen(true);
  };

  const hasPermission = (permissionKey: keyof UserProfile['permissions']): boolean => {
    return !!currentUser?.permissions?.[permissionKey];
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeRole,
        isLoginModalOpen,
        setIsLoginModalOpen,
        switchRole,
        loginWithRole,
        logout,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
