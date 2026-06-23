import React, { createContext, useContext, useMemo } from 'react';
import type { WorkspaceItem } from '../../types';

export interface WorkspaceContextValue {
  currentFileId: string;
  items: Record<string, WorkspaceItem>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  currentFileId,
  items,
  children,
}: {
  currentFileId: string;
  items: Record<string, WorkspaceItem>;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ currentFileId, items }), [currentFileId, items]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
