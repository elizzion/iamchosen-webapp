import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export interface ModalConfig {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  onClose?: () => void;
}

declare global {
  interface Window {
    showAppModal?: (options: ModalConfig) => void;
    showSuccess?: (message: string, title?: string) => void;
    showError?: (message: string, title?: string) => void;
    showWarning?: (message: string, title?: string) => void;
    showInfo?: (message: string, title?: string) => void;
  }
}

export default function GlobalModal() {
  const [modal, setModal] = useState<ModalConfig | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // 1. Define global trigger handlers
    const handleShowModal = (e: CustomEvent<ModalConfig>) => {
      setModal(e.detail);
      setIsOpen(true);
    };

    window.addEventListener('show-app-modal' as any, handleShowModal);

    window.showAppModal = (options: ModalConfig) => {
      window.dispatchEvent(new CustomEvent('show-app-modal', { detail: options }));
    };

    window.showSuccess = (message: string, title?: string) => {
      window.showAppModal?.({
        type: 'success',
        title: title || 'Success',
        message
      });
    };

    window.showError = (message: string, title?: string) => {
      window.showAppModal?.({
        type: 'error',
        title: title || 'Error Occurred',
        message
      });
    };

    window.showWarning = (message: string, title?: string) => {
      window.showAppModal?.({
        type: 'warning',
        title: title || 'Warning',
        message
      });
    };

    window.showInfo = (message: string, title?: string) => {
      window.showAppModal?.({
        type: 'info',
        title: title || 'Notification',
        message
      });
    };

    // Override default window.alert
    const originalAlert = window.alert;
    window.alert = (message: string) => {
      // Direct alerts to our gorgeous info modal
      window.showInfo?.(message, 'System Notification');
    };

    return () => {
      window.removeEventListener('show-app-modal' as any, handleShowModal);
      window.alert = originalAlert;
    };
  }, []);

  // Handle keyboard close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, modal]);

  const closeModal = () => {
    setIsOpen(false);
    if (modal?.onClose) {
      modal.onClose();
    }
    // Delay clearing modal data for smoother exit animation transition
    setTimeout(() => {
      setModal(null);
    }, 200);
  };

  if (!modal) return null;

  // Visual options based on message type
  const typeConfig = {
    success: {
      icon: <CheckCircle2 className="w-12 h-12 text-emerald-400" />,
      borderColor: 'border-emerald-500/30',
      accentColor: 'bg-emerald-500/10',
      btnColor: 'bg-emerald-500 hover:bg-emerald-600 text-black',
      gradient: 'from-emerald-500/20 via-transparent to-transparent'
    },
    error: {
      icon: <XCircle className="w-12 h-12 text-rose-400" />,
      borderColor: 'border-rose-500/30',
      accentColor: 'bg-rose-500/10',
      btnColor: 'bg-rose-500 hover:bg-rose-600 text-white',
      gradient: 'from-rose-500/20 via-transparent to-transparent'
    },
    warning: {
      icon: <AlertTriangle className="w-12 h-12 text-amber-400" />,
      borderColor: 'border-amber-500/30',
      accentColor: 'bg-amber-500/10',
      btnColor: 'bg-amber-500 hover:bg-amber-600 text-black',
      gradient: 'from-amber-500/20 via-transparent to-transparent'
    },
    info: {
      icon: <Info className="w-12 h-12 text-cyan-400" />,
      borderColor: 'border-cyan-500/30',
      accentColor: 'bg-cyan-500/10',
      btnColor: 'bg-cyan-500 hover:bg-cyan-600 text-black',
      gradient: 'from-cyan-500/20 via-transparent to-transparent'
    }
  };

  const current = typeConfig[modal.type] || typeConfig.info;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-all duration-300 ${
        isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
        onClick={closeModal}
      />

      {/* Modal Card */}
      <div
        className={`w-full max-w-md bg-[#0B0D12] border ${current.borderColor} rounded-2xl overflow-hidden shadow-2xl relative transition-all duration-300 transform ${
          isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        {/* Top Accent Gradient */}
        <div className={`absolute top-0 inset-x-0 h-24 bg-gradient-to-b ${current.gradient} opacity-50`} />

        {/* Close Button */}
        <button
          onClick={closeModal}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="p-6 pt-10 text-center relative z-10 flex flex-col items-center">
          {/* Icon Badge */}
          <div className={`p-4 rounded-2xl ${current.accentColor} border ${current.borderColor} mb-5 animate-pulse`}>
            {current.icon}
          </div>

          <h3 className="text-xl font-extrabold text-white uppercase tracking-tight mb-2">
            {modal.title}
          </h3>

          <p className="text-zinc-400 text-sm leading-relaxed max-h-48 overflow-y-auto w-full px-2 mb-6">
            {modal.message}
          </p>

          <button
            onClick={closeModal}
            className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-lg cursor-pointer ${current.btnColor}`}
          >
            Acknowledge
          </button>
        </div>
      </div>
    </div>
  );
}
