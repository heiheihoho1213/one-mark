import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'lucide-react';
import AppDialog, { AppDialogCancelButton, AppDialogPrimaryButton, appDialogInputClass, appDialogLabelClass } from './AppDialog';

interface InsertLinkDialogProps {
  open: boolean;
  defaultText: string;
  onConfirm: (url: string, text: string) => void;
  onCancel: () => void;
}

/** 插入/编辑 Markdown 链接 */
export default function InsertLinkDialog({
  open,
  defaultText,
  onConfirm,
  onCancel,
}: InsertLinkDialogProps) {
  const [url, setUrl] = useState('https://');
  const [text, setText] = useState(defaultText);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setText(defaultText || '链接');
    setUrl('https://');
    requestAnimationFrame(() => urlRef.current?.focus());
  }, [open, defaultText]);

  const submit = () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    onConfirm(trimmedUrl, text.trim() || trimmedUrl);
  };

  return (
    <AppDialog
      open={open}
      onClose={onCancel}
      title="插入链接"
      subtitle="在当前位置插入 Markdown 超链接"
      icon={<Link size={18} />}
      footer={
        <>
          <AppDialogCancelButton onClick={onCancel} />
          <AppDialogPrimaryButton onClick={submit} label="确定" />
        </>
      }
    >
      <div className="space-y-3">
        <label className={appDialogLabelClass}>
          链接地址
          <input
            ref={urlRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') onCancel();
            }}
            placeholder="https://example.com"
            className={appDialogInputClass}
          />
        </label>

        <label className={appDialogLabelClass}>
          显示文字
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') onCancel();
            }}
            placeholder="链接文字"
            className={appDialogInputClass}
          />
        </label>
      </div>
    </AppDialog>
  );
}
