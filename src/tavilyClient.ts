import axios from 'axios';
import { ApiKeyPool } from './apiKeyPool.js';

// Search params
export interface TavilySearchParams {
  query: string;
  search_depth?: 'basic' | 'advanced';
  topic?: 'general' | 'news';
  days?: number;
  time_range?: 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y';
  max_results?: number;
  include_images?: boolean;
  include_image_descriptions?: boolean;
  include_raw_content?: boolean;
  include_domains?: string[];
  exclude_domains?: string[];
}

// Extract params
export interface TavilyExtractParams {
  urls: string[];
  extract_depth?: 'basic' | 'advanced';
  include_images?: boolean;
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

export class TavilyClient {
  private apiKeyPool: ApiKeyPool;
  private baseURLs = {
    search: 'https://api.tavily.com/search',
    extract: 'https://api.tavily.com/extract',
    crawl: 'https://api.tavily.com/crawl',
    map: 'https://api.tavily.com/map'
  };
  
  constructor(apiKeys: string[]) {
    this.apiKeyPool = new ApiKeyPool(apiKeys);
  }

  private async makeRequest(endpoint: string, params: any): Promise<any> {
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
        timeout: 30000
      });

      this.apiKeyPool.markKeySuccess(apiKey);
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