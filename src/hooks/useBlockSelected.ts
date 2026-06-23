import { useSyncExternalStore } from 'react';
import type { DocumentStore } from '../document/DocumentStore';
import { isBlockSelected } from '../utils/blockEdit';

/** 订阅指定块是否处于整块选中态 */
export function useBlockSelected(blockId: string, store: DocumentStore): boolean {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => isBlockSelected(store.getState().selection, blockId),
    () => isBlockSelected(store.getState().selection, blockId)
  );
}
