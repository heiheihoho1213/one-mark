import React from 'react';
import { X } from 'lucide-react';

interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  /** 标题区图标底色，默认品牌色 */
  iconClassName?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  /** 点击遮罩是否关闭，默认 true */
  closeOnBackdrop?: boolean;
}

/** 应用内统一弹窗骨架（与删除确认弹窗一致） */
export default function AppDialog({
  open,
  onClose,
  title,
  subtitle,
  icon,
  iconClassName = 'bg-brand-rust/10 text-brand-rust',
  children,
  footer,
  closeOnBackdrop = true,
}: AppDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={closeOnBackdrop ? onClose : undefined}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-xl border border-brand-border bg-brand-cream shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-brand-border px-5 py-4 dark:border-neutral-700">
          <div className="flex items-center gap-2.5">
            <div className={`rounded-full p-2 ${iconClassName}`}>{icon}</div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-neutral-100">{title}</h3>
              {subtitle && (
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-neutral-400">{subtitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 text-sm text-gray-700 dark:text-neutral-300">{children}</div>

        <div className="flex items-center justify-end gap-2 border-t border-brand-border px-5 py-3.5 dark:border-neutral-700">
          {footer}
        </div>
      </div>
    </div>
  );
}

/** 弹窗取消按钮 */
export function AppDialogCancelButton({ onClick, label = '取消' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-brand-border/40 dark:text-neutral-300 dark:hover:bg-neutral-800"
    >
      {label}
    </button>
  );
}

/** 弹窗主操作按钮（深色底，悬停品牌色） */
export function AppDialogPrimaryButton({
  onClick,
  label,
  icon,
  disabled,
  variant = 'default',
}: {
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  variant?: 'default' | 'danger';
}) {
  const variantClass =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700'
      : 'bg-[#1a1a1a] hover:bg-brand-rust';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${variantClass}`}
    >
      {icon}
      {label}
    </button>
  );
}

/** 弹窗内输入框统一样式 */
export const appDialogInputClass =
  'mt-1 w-full rounded-lg border border-brand-border/60 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-rust/60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100';

/** 弹窗内标签统一样式 */
export const appDialogLabelClass = 'block text-xs font-medium text-gray-600 dark:text-neutral-400';
