export function parseTTL(ttl: string | number): number {
  if (typeof ttl === 'number') return ttl;
  
  const units = {
    'ms': 1,
    's': 1000,
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000,
    'w': 7 * 24 * 60 * 60 * 1000,
    'M': 30 * 24 * 60 * 60 * 1000,
    'y': 365 * 24 * 60 * 60 * 1000
  };
  
  const match = ttl.toString().match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)$/);
  if (!match) throw new Error(`Invalid TTL format: ${ttl}`);
  
  const value = parseFloat(match[1]);
  const unit = match[2] as keyof typeof units;
  
  if (!(unit in units)) {
    throw new Error(`Invalid TTL unit: ${unit}. Use: ${Object.keys(units).join(', ')}`);
  }
  
  return value * units[unit];
}

export function parseSize(size: string | number): number {
  if (typeof size === 'number') return size;
  
  const units = {
    'B': 1,
    'KB': 1024,
    'MB': 1024 * 1024,
    'GB': 1024 * 1024 * 1024,
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024
  };
  
  const match = size.toString().match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)$/);
  if (!match) throw new Error(`Invalid size format: ${size}`);
  
  const value = parseFloat(match[1]);
  const unit = match[2] as keyof typeof units;
  
  if (!(unit in units)) {
    throw new Error(`Invalid size unit: ${unit}. Use: ${Object.keys(units).join(', ')}`);
  }
  
  return value * units[unit];
}