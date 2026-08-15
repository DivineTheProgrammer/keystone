type AttemptRecord = {
  count: number
  firstAttemptAt: number
  blockedUntil: number | null
}

const attempts = new Map<string, AttemptRecord>()

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const BLOCK_MS = 15 * 60 * 1000

export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now()
  const record = attempts.get(key)

  if (!record) {
    attempts.set(key, { count: 1, firstAttemptAt: now, blockedUntil: null })
    return { allowed: true }
  }

  if (record.blockedUntil && now < record.blockedUntil) {
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000)
    return { allowed: false, retryAfterSeconds: retryAfterSeconds }
  }

  if (now - record.firstAttemptAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttemptAt: now, blockedUntil: null })
    return { allowed: true }
  }

  record.count = record.count + 1

  if (record.count > MAX_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_MS
    attempts.set(key, record)
    const retryAfterSeconds = Math.ceil(BLOCK_MS / 1000)
    return { allowed: false, retryAfterSeconds: retryAfterSeconds }
  }

  attempts.set(key, record)
  return { allowed: true }
}

export function resetRateLimit(key: string): void {
  attempts.delete(key)
}
