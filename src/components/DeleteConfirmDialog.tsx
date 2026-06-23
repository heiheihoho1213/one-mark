import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import AppDialog, { AppDialogCancelButton, AppDialogPrimaryButton } from './AppDialog';

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

/** 删除二次确认弹窗：两步确认后移入回收站（仅 Markdown 文件） */
export default function DeleteConfirmDialog({
  target,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (target) setStep(1);
  }, [target]);

  if (!target) return null;

  const handlePrimaryAction = () => {
    if (step === 1) {
      setStep(2);
      return;
    }
    onConfirm(target.id);
  };

  return (
    <AppDialog
      open={!!target}
      onClose={onCancel}
      title={step === 1 ? '删除确认' : '再次确认'}
      subtitle={`第 ${step} 步 / 共 2 步`}
      icon={<AlertTriangle size={18} />}
      iconClassName={step === 1 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}
      footer={
        <>
          <AppDialogCancelButton onClick={onCancel} />
          <AppDialogPrimaryButton
            onClick={handlePrimaryAction}
            label={step === 1 ? '继续' : '移入回收站'}
            icon={step === 2 ? <Trash2 size={13} /> : undefined}
            variant={step === 2 ? 'danger' : 'default'}
          />
        </>
      }
    >
      {step === 1 ? (
        <p className="leading-relaxed">
          确定要删除文件
          <span className="mx-1 font-semibold text-brand-rust">「{target.name}」</span>
          吗？
        </p>
      ) : (
        <p className="leading-relaxed">
          请再次确认：将把
          <span className="mx-1 font-semibold text-brand-rust">「{target.name}」</span>
          移入系统回收站，不会永久删除。
        </p>
      )}
    </AppDialog>
  );
}
