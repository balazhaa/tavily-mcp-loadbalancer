import axios from 'axios';
import { ApiKeyPool } from './apiKeyPool.js';

// Search params
export interface TavilySearchParams {
  query: string;
  search_depth?: 'basic' | 'advanced';
  topic?: 'general' | 'news';
  days?: number;
  time_range?: 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y';
  start_date?: string;
  end_date?: string;
  max_results?: number;
  include_images?: boolean;
  include_image_descriptions?: boolean;
  include_raw_content?: boolean;
  include_domains?: string[];
  exclude_domains?: string[];
  country?: string;
  include_favicon?: boolean;
}

// Extract params
export interface TavilyExtractParams {
  urls: string[];
  extract_depth?: 'basic' | 'advanced';
  include_images?: boolean;
  format?: 'markdown' | 'text';
  include_favicon?: boolean;
}

// Crawl params
export interface TavilyCrawlParams {
  url: string;
  max_depth?: number;
  max_breadth?: number;
  limit?: number;
  instructions?: string;
  select_paths?: string[];
  select_domains?: string[];
  allow_external?: boolean;
  categories?: string[];
  extract_depth?: 'basic' | 'advanced';
  format?: 'markdown' | 'text';
  include_favicon?: boolean;
}

// Map params
export interface TavilyMapParams {
  url: string;
  max_depth?: number;
  max_breadth?: number;
  limit?: number;
  instructions?: string;
  select_paths?: string[];
  select_domains?: string[];
  allow_external?: boolean;
  categories?: string[];
}

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  raw_content?: string;
  score: number;
  published_date?: string;
}

export interface TavilyResponse {
  query: string;
  follow_up_questions?: string[];
  answer?: string;
  images?: string[];
  results: TavilySearchResult[];
  response_time: number;
}

interface QueuedRequest {
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

export class TavilyClient {
  private apiKeyPool: ApiKeyPool;
  private baseURLs = {
    search: 'https://api.tavily.com/search',
    extract: 'https://api.tavily.com/extract',
    crawl: 'https://api.tavily.com/crawl',
    map: 'https://api.tavily.com/map'
  };
  
  // 请求队列管理
  private requestQueue: QueuedRequest[] = [];
  private activeRequests = 0;
  private maxConcurrent = 4; // 增加并发数，提高处理速度

  // 响应缓存（短期缓存，避免重复请求）
  private cache = new Map<string, CacheEntry>();
  private defaultCacheTTL = 30000; // 30秒缓存

  // 请求去重机制（防止并发相同请求）
  private pendingRequests = new Map<string, Promise<any>>();
  
  constructor(apiKeys: string[]) {
    this.apiKeyPool = new ApiKeyPool(apiKeys);

    // 定期清理过期缓存
    setInterval(() => this.cleanExpiredCache(), 60000); // 每分钟清理一次
  }

  // 缓存管理方法
  private getCacheKey(endpoint: string, params: any): string {
    return `${endpoint}:${JSON.stringify(params)}`;
  }

  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: any, ttl: number = this.defaultCacheTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // 队列管理方法
  private async enqueueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        execute: requestFn,
        resolve,
        reject
      };
      
      this.requestQueue.push(queuedRequest);
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.activeRequests >= this.maxConcurrent || this.requestQueue.length === 0) {
      return;
    }

    const request = this.requestQueue.shift();
    if (!request) return;

    this.activeRequests++;
    
    try {
      const result = await request.execute();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeRequests--;
      // 处理队列中的下一个请求
      if (this.requestQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }

  private async makeRequest(endpoint: string, params: any): Promise<any> {
    // 检查缓存
    const cacheKey = this.getCacheKey(endpoint, params);
    const cachedResult = this.getFromCache(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    // 检查是否有相同的请求正在进行中（请求去重）
    if (this.pendingRequests.has(cacheKey)) {
      console.error(`[${new Date().toISOString()}] [INFO] Request deduplication: waiting for existing request`);
      return this.pendingRequests.get(cacheKey);
    }

    // 创建新的请求Promise
    const requestPromise = this.enqueueRequest(async () => {
      const apiKey = this.apiKeyPool.getNextKey();
      if (!apiKey) {
        throw new Error('No available API keys');
      }

      try {
        const response = await axios.post(endpoint, {
          api_key: apiKey,
          ...params
        }, {
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json'
          },
          timeout: 25000  // 调整为25秒，提供更充足的响应时间
        });

        this.apiKeyPool.markKeySuccess(apiKey);

        // 验证响应数据
        if (!response.data || typeof response.data !== 'object') {
          throw new Error('Invalid response format from Tavily API');
        }

        // 检查响应大小
        const responseSize = JSON.stringify(response.data).length;
        if (responseSize > 1000000) { // 1MB限制
          console.warn(`Large response detected: ${responseSize} bytes`);
        }

        // 缓存成功的响应
        this.setCache(cacheKey, response.data);

        return response.data;
      } catch (error: any) {
        console.error(`Tavily API error with key ${apiKey.substring(0, 10)}...:`, error.message);
        this.apiKeyPool.markKeyError(apiKey);
        
        // Handle specific API errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.warn(`Invalid API key ${apiKey.substring(0, 10)}..., disabling`);
          this.apiKeyPool.markKeyError(apiKey);
        }
        
        throw error;
      }
    });

    // 将请求Promise存储到pending map中
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // 请求完成后从pending map中移除
      this.pendingRequests.delete(cacheKey);
    }
  }

  async search(params: TavilySearchParams): Promise<TavilyResponse> {
    // Add automatic topic detection for news
    const searchParams = {
      ...params,
      topic: params.query.toLowerCase().includes('news') ? 'news' : params.topic
    };
    
    return this.makeRequest(this.baseURLs.search, searchParams);
  }

  async extract(params: TavilyExtractParams): Promise<any> {
    return this.makeRequest(this.baseURLs.extract, params);
  }

  async crawl(params: TavilyCrawlParams): Promise<any> {
    return this.makeRequest(this.baseURLs.crawl, params);
  }

  async map(params: TavilyMapParams): Promise<any> {
    return this.makeRequest(this.baseURLs.map, params);
  }

  getKeyPoolStats() {
    return this.apiKeyPool.getStats();
  }

  addApiKey(key: string) {
    this.apiKeyPool.addKey(key);
  }

  removeApiKey(key: string) {
    return this.apiKeyPool.removeKey(key);
  }
}