import React from 'react';
import { AlertTriangle } from 'lucide-react';
import AppDialog, { AppDialogCancelButton, AppDialogPrimaryButton } from './AppDialog';

interface FileConflictDialogProps {
  open: boolean;
  fileName: string;
  onKeepLocal: () => void;
  onUseDisk: () => void;
  onCancel: () => void;
}

/** 外部文件变更与本地编辑冲突时的选择弹窗 */
export default function FileConflictDialog({
  open,
  fileName,
  onKeepLocal,
  onUseDisk,
  onCancel,
}: FileConflictDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onCancel}
      title="文件已在外部被修改"
      subtitle="请选择保留哪一版内容"
      icon={<AlertTriangle size={18} />}
      iconClassName="bg-amber-100 text-amber-700"
      footer={
        <>
          <AppDialogCancelButton onClick={onCancel} label="稍后决定" />
          <button
            type="button"
            onClick={onUseDisk}
            className="rounded-lg border border-brand-border px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-brand-sidebar/50 dark:border-neutral-600 dark:text-neutral-300"
          >
            使用磁盘版本
          </button>
          <AppDialogPrimaryButton onClick={onKeepLocal} label="保留本地编辑" />
        </>
      }
    >
      <p className="leading-relaxed">
        「<span className="font-semibold text-brand-rust">{fileName}</span>
        」在磁盘上的内容已更新，与您当前的编辑可能不一致。
      </p>
    </AppDialog>
  );
}
