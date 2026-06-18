import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export interface DeleteTarget {
  id: string;
  name: string;
  type: 'file' | 'directory';
}

interface DeleteConfirmDialogProps {
  target: DeleteTarget | null;
  onCancel: () => void;
  onConfirm: (itemId: string) => void;
}

/** 删除二次确认弹窗：两步确认后移入回收站 */
export default function DeleteConfirmDialog({
  target,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);

  // 每次打开弹窗时重置为第一步
  useEffect(() => {
    if (target) setStep(1);
  }, [target]);

  if (!target) return null;

  const itemLabel = target.type === 'file' ? '文件' : '文件夹';

  const handlePrimaryAction = () => {
    if (step === 1) {
      setStep(2);
      return;
    }
    onConfirm(target.id);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onCancel}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="relative w-full max-w-md rounded-xl border border-brand-border bg-brand-cream shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-brand-border px-5 py-4 dark:border-neutral-700">
          <div className="flex items-center gap-2.5">
            <div className={`rounded-full p-2 ${step === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 id="delete-dialog-title" className="text-sm font-bold text-gray-900 dark:text-neutral-100">
                {step === 1 ? '删除确认' : '再次确认'}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-neutral-400 mt-0.5">
                第 {step} 步 / 共 2 步
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="rounded p-1 text-gray-400 hover:bg-black/5 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-neutral-200"
            title="取消"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 text-sm text-gray-700 dark:text-neutral-300 leading-relaxed">
          {step === 1 ? (
            <>
              确定要删除{itemLabel}
              <span className="mx-1 font-semibold text-brand-rust">「{target.name}」</span>
              吗？
            </>
          ) : (
            <>
              请再次确认：将把
              <span className="mx-1 font-semibold text-brand-rust">「{target.name}」</span>
              移入系统回收站，不会永久删除。
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-brand-border px-5 py-3.5 dark:border-neutral-700">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-brand-border/40 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            取消
          </button>
          <button
            onClick={handlePrimaryAction}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-sm ${
              step === 1
                ? 'bg-[#1a1a1a] hover:bg-brand-rust'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {step === 1 ? (
              '继续'
            ) : (
              <>
                <Trash2 size={13} />
                移入回收站
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
