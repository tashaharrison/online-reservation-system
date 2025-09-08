import redisClient from '../database/redisClient';
import { saveSeatToRedis, getSeatById, SeatStatus } from '../models/seat.model';

export async function initRedisKeyspaceNotifications() {
  // Create the Redis client for pub/sub
  const subscriber = redisClient.duplicate();
  await subscriber.connect();

  // Listen for expired keys in the Redis database
  const expiredChannel = `__keyevent@0__:expired`;

  await subscriber.subscribe(expiredChannel, async (key: string) => {
    // Check if the expired key is a seat lock
    if (key.startsWith('seat:') && key.endsWith(':lock')) {
      const seatId = key.split(':')[1];
      const seat = await getSeatById(seatId);
      if (seat && seat.status !== SeatStatus.AVAILABLE) {
        seat.status = SeatStatus.AVAILABLE;
        seat.UUID = '';
        await saveSeatToRedis(seat);
        console.log(`Seat ${seatId} status updated to available after lock expired.`);
      }
    }
  });
}
