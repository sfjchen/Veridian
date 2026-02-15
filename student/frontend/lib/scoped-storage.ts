export function scopedKey(userId: string, key: string): string {
  return `user:${userId}:${key}`;
}
