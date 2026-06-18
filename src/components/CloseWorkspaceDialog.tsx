import React, { useEffect, useState } from 'react';
import { FolderX, X } from 'lucide-react';

interface CloseWorkspaceDialogProps {
  folderName: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 关闭工作区文件夹引用的二次确认弹窗（不删除磁盘文件） */
export default function CloseWorkspaceDialog({
  folderName,
  onCancel,
  onConfirm,
}: CloseWorkspaceDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (folderName) setStep(1);
  }, [folderName]);

  if (!folderName) return null;

  const handlePrimaryAction = () => {
    if (step === 1) {
      setStep(2);
      return;
    }
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onCancel}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-workspace-dialog-title"
        className="relative w-full max-w-md rounded-xl border border-brand-border bg-brand-cream shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-brand-border px-5 py-4 dark:border-neutral-700">
          <div className="flex items-center gap-2.5">
            <div className="rounded-full p-2 bg-amber-100 text-amber-700">
              <FolderX size={18} />
            </div>
            <div>
              <h3 id="close-workspace-dialog-title" className="text-sm font-bold text-gray-900 dark:text-neutral-100">
                {step === 1 ? '关闭文件夹' : '再次确认'}
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
              确定要关闭文件夹
              <span className="mx-1 font-semibold text-brand-rust">「{folderName}」</span>
              的引用吗？
            </>
          ) : (
            <>
              请再次确认：关闭后仅取消编辑器关联，磁盘上的文件
              <span className="font-semibold">不会被删除</span>。是否继续？
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
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white shadow-sm bg-[#1a1a1a] hover:bg-brand-rust"
          >
            {step === 1 ? (
              '继续'
            ) : (
              <>
                <FolderX size={13} />
                关闭引用
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
