import { create } from 'zustand';
import type { ToastType } from '../components/common/Toast';

interface ToastState {
  message: string | null;
  type: ToastType;
  showToast: (message: string, type: ToastType) => void;
  hideToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type: 'info',
  showToast: (message, type) => set({ message, type }),
  hideToast: () => set({ message: null })
}));