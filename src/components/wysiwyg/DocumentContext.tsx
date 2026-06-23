import React, { createContext, useContext, useMemo } from 'react';
import type { DocumentStore } from '../../document/DocumentStore';

const DocumentContext = createContext<DocumentStore | null>(null);

export function DocumentProvider({
  store,
  children,
}: {
  store: DocumentStore;
  children: React.ReactNode;
}) {
  const value = useMemo(() => store, [store]);
  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>;
}

export function useDocumentStore(): DocumentStore {
  const store = useContext(DocumentContext);
  if (!store) throw new Error('useDocumentStore must be used within DocumentProvider');
  return store;
}
