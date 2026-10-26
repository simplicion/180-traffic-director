// === @workspace/backend-common ===
// Shared backend utilities for Traffic Director

export { eventBus } from './eventBus';
export { logAction, type AuditContext } from './audit';
export {
  triggerAutomation,
  registerAutomationProvider,
  type AutomationEvent,
} from './automation';
export { emitSocket, registerSocketProvider } from './socket';
export {
  getCache,
  setCache,
  delCache,
  getCachedData,
  setCachedData,
  clearCache,
} from './cache';
export {
  paginateWithCursor,
  extractPaginationParams,
  encodeCursor,
  decodeCursor,
  type PaginationOptions,
  type PaginatedResult,
  type PageInfo,
  type CursorPayload,
  type PaginationDirection,
  type ExtractedPaginationParams
} from './pagination';
