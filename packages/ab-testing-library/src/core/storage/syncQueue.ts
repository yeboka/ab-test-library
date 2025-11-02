import { storageManager } from './storageManager'
import { NetworkError } from '../errors'

/**
 * Sync operation types
 */
export type SyncOperationType = 'user' | 'variant'
export type SyncOperationAction = 'create' | 'update' | 'delete'

/**
 * Interface for sync operations stored in the queue
 */
export interface SyncOperation {
  id: string
  type: SyncOperationType
  operation: SyncOperationAction
  data: any
  timestamp: number
  retries: number
}

/**
 * Maximum number of retry attempts before giving up
 */
const MAX_RETRIES = 5

/**
 * Base delay in milliseconds for exponential backoff
 */
const BASE_DELAY_MS = 1000

/**
 * Maximum delay in milliseconds for exponential backoff
 */
const MAX_DELAY_MS = 30000

/**
 * Storage key for sync queue
 */
const SYNC_QUEUE_KEY = 'ab_sync_queue'

/**
 * Check if browser is online
 */
function isOnline(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.onLine === 'undefined') {
    // Assume online if we can't detect offline status
    return true
  }
  return navigator.onLine
}

/**
 * Calculate exponential backoff delay
 * @param retries - Number of retry attempts
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(retries: number): number {
  const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retries), MAX_DELAY_MS)
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 * delay
  return Math.floor(delay + jitter)
}

/**
 * SyncQueue - Manages pending sync operations with retry logic
 */
class SyncQueue {
  /**
   * Get all pending sync operations
   */
  private getQueue(): SyncOperation[] {
    try {
      return storageManager.getItem<SyncOperation[]>(SYNC_QUEUE_KEY) || []
    } catch {
      return []
    }
  }

  /**
   * Save the sync queue to storage
   */
  private saveQueue(queue: SyncOperation[]): void {
    try {
      storageManager.setItem(SYNC_QUEUE_KEY, queue)
    } catch (error) {
      // If storage fails, log but don't throw - we'll lose queued ops but continue
      if (typeof console !== 'undefined' && console.error) {
        console.error('[ABTesting] Failed to save sync queue:', error)
      }
    }
  }

  /**
   * Add an operation to the sync queue
   * @param type - Type of operation (user or variant)
   * @param operation - Action (create, update, delete)
   * @param data - Data to sync
   */
  add(type: SyncOperationType, operation: SyncOperationAction, data: any): void {
    const queue = this.getQueue()
    const syncOp: SyncOperation = {
      id: `${type}_${operation}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type,
      operation,
      data,
      timestamp: Date.now(),
      retries: 0
    }
    queue.push(syncOp)
    this.saveQueue(queue)
  }

  /**
   * Remove an operation from the queue
   * @param operationId - ID of the operation to remove
   */
  remove(operationId: string): void {
    const queue = this.getQueue()
    const filtered = queue.filter(op => op.id !== operationId)
    this.saveQueue(filtered)
  }

  /**
   * Get all pending operations
   */
  getAll(): SyncOperation[] {
    return this.getQueue()
  }

  /**
   * Get pending operations of a specific type
   * @param type - Type of operations to get
   */
  getByType(type: SyncOperationType): SyncOperation[] {
    return this.getQueue().filter(op => op.type === type)
  }

  /**
   * Clear all operations from the queue
   */
  clear(): void {
    this.saveQueue([])
  }

  /**
   * Process a single sync operation
   * This is called by the service-specific sync handlers
   * @param operation - The operation to process
   * @param syncFn - Function that performs the actual sync
   * @returns true if sync succeeded, false otherwise
   */
  async processOperation(
    operation: SyncOperation,
    syncFn: (operation: SyncOperation) => Promise<void>
  ): Promise<boolean> {
    if (!isOnline()) {
      return false
    }

    try {
      await syncFn(operation)
      this.remove(operation.id)
      return true
    } catch (error) {
      // Increment retry count
      const queue = this.getQueue()
      const opIndex = queue.findIndex(op => op.id === operation.id)
      if (opIndex >= 0) {
        queue[opIndex].retries += 1

        // Remove if max retries exceeded
        if (queue[opIndex].retries >= MAX_RETRIES) {
          queue.splice(opIndex, 1)
          if (typeof console !== 'undefined' && console.warn) {
            console.warn(`[ABTesting] Sync operation failed after ${MAX_RETRIES} retries:`, operation)
          }
        } else {
          this.saveQueue(queue)
        }
      }
      return false
    }
  }

  /**
   * Process all pending operations with exponential backoff
   * @param syncFn - Function that performs the sync for each operation
   */
  async processAll(syncFn: (operation: SyncOperation) => Promise<void>): Promise<void> {
    if (!isOnline()) {
      return
    }

    const queue = this.getQueue()
    if (queue.length === 0) {
      return
    }

    // Process operations one at a time with backoff
    for (const operation of queue) {
      const success = await this.processOperation(operation, syncFn)

      // If failed and not max retries, wait before next attempt
      if (!success && operation.retries < MAX_RETRIES) {
        const delay = calculateBackoffDelay(operation.retries)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  /**
   * Process operations of a specific type
   * @param type - Type of operations to process
   * @param syncFn - Function that performs the sync
   */
  async processByType(type: SyncOperationType, syncFn: (operation: SyncOperation) => Promise<void>): Promise<void> {
    if (!isOnline()) {
      return
    }

    const operations = this.getByType(type)
    for (const operation of operations) {
      const success = await this.processOperation(operation, syncFn)

      // If failed and not max retries, wait before next attempt
      if (!success) {
        // Check if operation still exists in queue (might have been removed if max retries)
        const queue = this.getQueue()
        const currentOp = queue.find(op => op.id === operation.id)
        if (currentOp && currentOp.retries < MAX_RETRIES) {
          const delay = calculateBackoffDelay(currentOp.retries)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
  }

  /**
   * Check if there are pending operations
   */
  hasPending(): boolean {
    return this.getQueue().length > 0
  }

  /**
   * Get count of pending operations
   */
  getPendingCount(): number {
    return this.getQueue().length
  }

  /**
   * Process all pending operations using registered handlers
   * This can be called manually or is automatically called on online event
   */
  async processAllPending(): Promise<void> {
    await processAllOperations()
  }
}

/**
 * Singleton instance of SyncQueue
 */
export const syncQueue = new SyncQueue()

/**
 * Registry for sync handlers by operation type
 */
const syncHandlers: Map<SyncOperationType, (operation: SyncOperation) => Promise<void>> = new Map()

/**
 * Register a sync handler for a specific operation type
 * @param type - Operation type ('user' or 'variant')
 * @param handler - Function that performs the sync
 */
export function registerSyncHandler(
  type: SyncOperationType,
  handler: (operation: SyncOperation) => Promise<void>
): void {
  syncHandlers.set(type, handler)
}

/**
 * Process all pending operations by routing them to registered handlers
 */
async function processAllOperations(): Promise<void> {
  if (!isOnline()) {
    return
  }

  const queue = syncQueue.getAll()
  if (queue.length === 0) {
    return
  }

  // Group operations by type and process each type
  const operationsByType = new Map<SyncOperationType, SyncOperation[]>()
  for (const operation of queue) {
    const ops = operationsByType.get(operation.type) || []
    ops.push(operation)
    operationsByType.set(operation.type, ops)
  }

  // Process each type using its registered handler
  for (const [type, operations] of operationsByType) {
    const handler = syncHandlers.get(type)
    if (handler) {
      await syncQueue.processByType(type, handler)
    } else {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[ABTesting] No sync handler registered for type: ${type}`)
      }
    }
  }
}

/**
 * Initialize sync queue processing on online event
 * This will trigger automatic sync when browser comes online
 */
if (typeof window !== 'undefined' && typeof window.addEventListener !== 'undefined') {
  window.addEventListener('online', () => {
    // Trigger sync when coming back online
    processAllOperations().catch(error => {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[ABTesting] Error processing sync queue on online event:', error)
      }
    })
    if (typeof console !== 'undefined' && console.log) {
      console.log('[ABTesting] Browser came online, sync operations will be processed')
    }
  })
}
