export interface SyncQueueItem {
  id: string;
  scope: "appconfig" | "userpref";
  key: string;
  value: unknown;
  prevValue: unknown;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
}

const STORAGE_KEY = "erp:sync-queue:v1";

const readQueue = (): SyncQueueItem[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as SyncQueueItem[];
  } catch {
    return [];
  }
};

const writeQueue = (items: SyncQueueItem[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

export const enqueueSync = (item: Omit<SyncQueueItem, "id" | "attempts" | "nextAttemptAt" | "createdAt">) => {
  const queue = readQueue();
  queue.push({
    ...item,
    id: crypto.randomUUID(),
    attempts: 0,
    nextAttemptAt: Date.now(),
    createdAt: Date.now(),
  });
  writeQueue(queue);
};

export const getPendingSync = () => readQueue();

export const processSyncQueue = async (processor: (item: SyncQueueItem) => Promise<boolean>) => {
  const queue = readQueue();
  const now = Date.now();
  const remaining: SyncQueueItem[] = [];

  for (const item of queue) {
    if (item.nextAttemptAt > now) {
      remaining.push(item);
      continue;
    }

    const ok = await processor(item);
    if (!ok) {
      const attempts = item.attempts + 1;
      const backoff = Math.min(30_000, 1000 * 2 ** attempts);
      remaining.push({ ...item, attempts, nextAttemptAt: now + backoff });
    }
  }

  writeQueue(remaining);
};
