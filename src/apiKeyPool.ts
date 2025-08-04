export interface ApiKeyConfig {
  key: string;
  weight?: number;
  active?: boolean;
  lastUsed?: Date;
  errorCount?: number;
  maxErrors?: number;
}

export class ApiKeyPool {
  private keys: ApiKeyConfig[] = [];
  private currentIndex = 0;

  constructor(keys: string[] | ApiKeyConfig[]) {
    this.keys = keys.map(key => {
      if (typeof key === 'string') {
        return {
          key,
          weight: 1,
          active: true,
          lastUsed: new Date(0),
          errorCount: 0,
          maxErrors: 5
        };
      }
      return {
        weight: 1,
        active: true,
        lastUsed: new Date(0),
        errorCount: 0,
        maxErrors: 5,
        ...key
      };
    });
  }

  getNextKey(): string | null {
    const activeKeys = this.keys.filter(k => k.active);
    
    if (activeKeys.length === 0) {
      console.warn('No active API keys available');
      return null;
    }

    // 使用轮询策略选择下一个密钥
    const key = activeKeys[this.currentIndex % activeKeys.length];
    this.currentIndex = (this.currentIndex + 1) % activeKeys.length;
    
    key.lastUsed = new Date();
    return key.key;
  }

  markKeyError(keyValue: string): void {
    const key = this.keys.find(k => k.key === keyValue);
    if (key) {
      key.errorCount = (key.errorCount || 0) + 1;
      
      if (key.errorCount >= (key.maxErrors || 5)) {
        console.warn(`API key ${keyValue.substring(0, 10)}... disabled due to too many errors`);
        key.active = false;
      }
    }
  }

  markKeySuccess(keyValue: string): void {
    const key = this.keys.find(k => k.key === keyValue);
    if (key) {
      key.errorCount = 0;
    }
  }

  reactivateKey(keyValue: string): void {
    const key = this.keys.find(k => k.key === keyValue);
    if (key) {
      key.active = true;
      key.errorCount = 0;
    }
  }

  getStats(): { total: number; active: number; keys: ApiKeyConfig[] } {
    return {
      total: this.keys.length,
      active: this.keys.filter(k => k.active).length,
      keys: this.keys.map(k => ({
        ...k,
        key: k.key.substring(0, 10) + '...' // 隐藏完整密钥
      }))
    };
  }

  addKey(key: string | ApiKeyConfig): void {
    const keyConfig = typeof key === 'string' ? {
      key,
      weight: 1,
      active: true,
      lastUsed: new Date(0),
      errorCount: 0,
      maxErrors: 5
    } : {
      weight: 1,
      active: true,
      lastUsed: new Date(0),
      errorCount: 0,
      maxErrors: 5,
      ...key
    };

    this.keys.push(keyConfig);
  }

  removeKey(keyValue: string): boolean {
    const index = this.keys.findIndex(k => k.key === keyValue);
    if (index > -1) {
      this.keys.splice(index, 1);
      return true;
    }
    return false;
  }
}