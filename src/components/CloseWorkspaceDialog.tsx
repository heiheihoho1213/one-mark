import React, { useEffect, useState } from 'react';
import { FolderX } from 'lucide-react';
import AppDialog, { AppDialogCancelButton, AppDialogPrimaryButton } from './AppDialog';

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
    <AppDialog
      open={!!folderName}
      onClose={onCancel}
      title={step === 1 ? '关闭文件夹' : '再次确认'}
      subtitle={`第 ${step} 步 / 共 2 步`}
      icon={<FolderX size={18} />}
      iconClassName="bg-amber-100 text-amber-700"
      footer={
        <>
          <AppDialogCancelButton onClick={onCancel} />
          <AppDialogPrimaryButton
            onClick={handlePrimaryAction}
            label={step === 1 ? '继续' : '关闭引用'}
            icon={step === 2 ? <FolderX size={13} /> : undefined}
          />
        </>
      }
    >
      {step === 1 ? (
        <p className="leading-relaxed">
          确定要关闭文件夹
          <span className="mx-1 font-semibold text-brand-rust">「{folderName}」</span>
          的引用吗？关闭引用并不会删除该文件夹。
        </p>
      ) : (
        <p className="leading-relaxed">
          请再次确认：关闭后仅取消编辑器关联，磁盘上的文件
          <span className="font-semibold">不会被删除</span>。是否继续？
        </p>
      )}
    </AppDialog>
  );
}
