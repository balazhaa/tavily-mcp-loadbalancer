import { ApiKeyPool } from '../src/apiKeyPool.js';
import { TavilyClient } from '../src/tavilyClient.js';

describe('ApiKeyPool', () => {
  test('should rotate keys correctly', () => {
    const pool = new ApiKeyPool(['key1', 'key2', 'key3']);
    
    const key1 = pool.getNextKey();
    const key2 = pool.getNextKey();
    const key3 = pool.getNextKey();
    const key4 = pool.getNextKey(); // should wrap around to key1
    
    expect(key1).toBe('key1');
    expect(key2).toBe('key2');
    expect(key3).toBe('key3');
    expect(key4).toBe('key1');
  });

  test('should disable key after max errors', () => {
    const pool = new ApiKeyPool([{
      key: 'test-key',
      maxErrors: 2
    }]);
    
    pool.markKeyError('test-key');
    pool.markKeyError('test-key');
    
    const key = pool.getNextKey();
    expect(key).toBeNull();
  });

  test('should get correct stats', () => {
    const pool = new ApiKeyPool(['key1', 'key2']);
    pool.markKeyError('key1');
    pool.markKeyError('key1');
    pool.markKeyError('key1');
    pool.markKeyError('key1');
    pool.markKeyError('key1'); // disable key1
    
    const stats = pool.getStats();
    expect(stats.total).toBe(2);
    expect(stats.active).toBe(1);
  });
});