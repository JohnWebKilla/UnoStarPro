// Cache utility functions
export function isExpired(timestamp: number): boolean {
  return Date.now() > timestamp;
}
