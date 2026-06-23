import React, { useEffect, useRef, useState } from 'react';
import { Image, Upload } from 'lucide-react';
import AppDialog, { AppDialogCancelButton, AppDialogPrimaryButton, appDialogInputClass, appDialogLabelClass } from './AppDialog';

interface InsertImageDialogProps {
  open: boolean;
  defaultUrl?: string;
  defaultAlt?: string;
  onConfirm: (url: string, alt: string) => void;
  onCancel: () => void;
}

/** 插入 Markdown 图片 */
export default function InsertImageDialog({
  open,
  defaultUrl,
  defaultAlt,
  onConfirm,
  onCancel,
}: InsertImageDialogProps) {
  const [url, setUrl] = useState('images/photo.png');
  const [alt, setAlt] = useState('图片描述');
  const fileRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setUrl(defaultUrl ?? 'images/photo.png');
    setAlt(defaultAlt ?? '图片描述');
    requestAnimationFrame(() => urlRef.current?.focus());
  }, [open, defaultUrl, defaultAlt]);

  const submit = () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    onConfirm(trimmedUrl, alt.trim() || '图片');
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setUrl(dataUrl);
      if (!alt || alt === '图片描述') {
        setAlt(file.name.replace(/\.[^.]+$/, ''));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <AppDialog
      open={open}
      onClose={onCancel}
      title="插入图片"
      subtitle="支持工作区路径、网络地址或本机图片"
      icon={<Image size={18} />}
      footer={
        <>
          <AppDialogCancelButton onClick={onCancel} />
          <AppDialogPrimaryButton onClick={submit} label="确定" />
        </>
      }
    >
      <div className="space-y-3">
        <label className={appDialogLabelClass}>
          图片路径或 URL
          <div className="mt-1 flex gap-2">
            <input
              ref={urlRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') onCancel();
              }}
              placeholder="images/photo.png 或 https://..."
              className={`${appDialogInputClass} mt-0 min-w-0 flex-1`}
            />
            <button
              type="button"
              title="从本机选择图片"
              onClick={() => fileRef.current?.click()}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-brand-border/60 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-brand-border/20 dark:border-neutral-700 dark:text-neutral-300"
            >
              <Upload size={13} />
              选择
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
          </div>
        </label>

        <label className={appDialogLabelClass}>
          替代文字（alt）
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') onCancel();
            }}
            placeholder="图片描述"
            className={appDialogInputClass}
          />
        </label>

        <p className="text-[11px] leading-relaxed text-gray-400 dark:text-neutral-500">
          工作区相对路径如 images/photo.png；也可粘贴网络地址或从本机选择（嵌入为 data URL）。
        </p>
      </div>
    </AppDialog>
  );
}
