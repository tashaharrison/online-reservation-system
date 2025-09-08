import redisClient from '../database/redisClient';

/**
 * Attempts to acquire a Redis lock for a seat.
 * @param {string} seatId - The seat ID to lock.
 * @param {string} UUID - The user's UUID.
 * @param {number} expiration - Lock expiration time in seconds.
 * @returns {Promise<'OK' | null>} 'OK' if lock acquired, null otherwise.
 */
export async function acquireSeatLock(seatId: string, UUID: string, expiration: number = 60): Promise<'OK' | null> {
  const lockKey = `seat:${seatId}:lock`;
  const result = await redisClient.set(lockKey, UUID, {
    NX: true,
    EX: expiration,
  });
  return result === 'OK' ? 'OK' : null;
}

/**
 * Releases a seat lock manually (if needed).
 * @param {string} seatId - The seat ID to unlock.
 * @returns {Promise<void>}
 */
export async function releaseSeatLock(seatId: string): Promise<void> {
  const lockKey = `seat:${seatId}:lock`;
  await redisClient.del(lockKey);
}
