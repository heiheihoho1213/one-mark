import React from 'react';
import type { InlineContent } from '../../ast/types';

/** 将行内 AST 渲染为展示用 React 节点 */
export function InlineRenderer({ content }: { content: InlineContent }) {
  return (
    <>
      {content.map((seg, i) => {
        if (!seg.text) return null;
        let node: React.ReactNode = seg.text;
        const m = seg.marks;
        if (m.link) {
          node = (
            <a
              href={m.link}
              className="text-brand-rust underline decoration-brand-rust/50 underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              {node}
            </a>
          );
        }
        if (m.code) node = <code className="rounded bg-brand-border/30 px-1 font-mono text-[0.9em]">{node}</code>;
        if (m.strike) node = <s>{node}</s>;
        if (m.bold && m.italic) node = <strong><em>{node}</em></strong>;
        else if (m.bold) node = <strong>{node}</strong>;
        else if (m.italic) node = <em>{node}</em>;
        return <React.Fragment key={i}>{node}</React.Fragment>;
      })}
    </>
  );
}
