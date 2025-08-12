#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { TavilyClient, TavilySearchParams, TavilyExtractParams, TavilyCrawlParams, TavilyMapParams } from './tavilyClient.js';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// 移除全局锁管理器，改为直接并发处理

// 日志记录工具 - 所有日志都输出到stderr，避免污染stdout的JSON-RPC消息流
export function logWithTimestamp(level: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;

  // MCP协议要求stdout只能输出JSON-RPC消息，所有日志都必须输出到stderr
  console.error(logMessage, data || '');
}

// 数据清理和验证工具函数
export function sanitizeText(text: any, maxLength: number = 5000): string {
  if (text === null || text === undefined) {
    return '';
  }

  let str = String(text);

  // 移除或替换可能导致JSON解析问题的字符
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // 移除控制字符
  str = str.replace(/[\uFFFE\uFFFF]/g, ''); // 移除Unicode非字符

  // 限制长度
  if (str.length > maxLength) {
    str = str.substring(0, maxLength) + '... [内容已截断]';
  }

  return str;
}

function validateAndSanitizeResponse(response: any): any {
  if (!response || typeof response !== 'object') {
    return { error: 'Invalid response format' };
  }

  try {
    // 创建一个安全的响应副本
    const safeResponse = {
      query: sanitizeText(response.query, 500),
      answer: response.answer ? sanitizeText(response.answer, 2000) : undefined,
      results: [],
      images: [],
      response_time: response.response_time || 0
    };

    // 处理搜索结果
    if (Array.isArray(response.results)) {
      safeResponse.results = response.results.slice(0, 10).map((result: any) => ({
        title: sanitizeText(result.title, 200),
        url: sanitizeText(result.url, 500),
        content: sanitizeText(result.content, 3000),
        raw_content: result.raw_content ? sanitizeText(result.raw_content, 2000) : undefined,
        score: result.score || 0
      }));
    }

    // 处理图片
    if (Array.isArray(response.images)) {
      safeResponse.images = response.images.slice(0, 5).map((image: any) => {
        if (typeof image === 'string') {
          return sanitizeText(image, 500);
        } else {
          return {
            url: sanitizeText(image.url, 500),
            description: image.description ? sanitizeText(image.description, 200) : undefined
          };
        }
      });
    }

    return safeResponse;
  } catch (error) {
    console.error('Error sanitizing response:', error);
    return { error: 'Failed to process response data' };
  }
}

// Result formatting functions
export function formatResults(response: any): string {
  const safeResponse = validateAndSanitizeResponse(response);

  if (safeResponse.error) {
    return `Error: ${safeResponse.error}`;
  }

  const output = [];

  if (safeResponse.answer) {
    output.push(`Answer: ${safeResponse.answer}`);
  }

  output.push('Detailed Results:');
  safeResponse.results.forEach((result: any, index: number) => {
    output.push(`\n[${index + 1}] Title: ${result.title}`);
    output.push(`URL: ${result.url}`);
    output.push(`Content: ${result.content}`);
    if (result.raw_content) {
      output.push(`Raw Content: ${result.raw_content}`);
    }
    if (result.score) {
      output.push(`Relevance Score: ${result.score}`);
    }
  });

  if (safeResponse.images && safeResponse.images.length > 0) {
    output.push('\nImages:');
    safeResponse.images.forEach((image: any, index: number) => {
      if (typeof image === 'string') {
        output.push(`\n[${index + 1}] URL: ${image}`);
      } else {
        output.push(`\n[${index + 1}] URL: ${image.url}`);
        if (image.description) {
          output.push(`   Description: ${image.description}`);
        }
      }
    });
  }

  const result = output.join('\n');

  // 最终检查结果大小
  if (result.length > 50000) {
    return result.substring(0, 50000) + '\n\n... [响应内容过长，已截断]';
  }

  return result;
}

export function formatCrawlResults(response: any): string {
  try {
    if (!response || typeof response !== 'object') {
      return 'Error: Invalid crawl response format';
    }

    const output = [];
    output.push(`Crawl Results:`);
    output.push(`Base URL: ${sanitizeText(response.base_url, 500)}`);
    output.push('\nCrawled Pages:');

    if (Array.isArray(response.results)) {
      response.results.slice(0, 20).forEach((page: any, index: number) => {
        output.push(`\n[${index + 1}] URL: ${sanitizeText(page.url, 500)}`);
        if (page.raw_content) {
          const cleanContent = sanitizeText(page.raw_content, 1000);
          const contentPreview = cleanContent.length > 300
            ? cleanContent.substring(0, 300) + "... [内容已截断]"
            : cleanContent;
          output.push(`Content: ${contentPreview}`);
        }
        if (page.title) {
          output.push(`Title: ${sanitizeText(page.title, 200)}`);
        }
      });
    }

    const result = output.join('\n');

    // 限制总输出大小
    if (result.length > 30000) {
      return result.substring(0, 30000) + '\n\n... [爬取结果过长，已截断]';
    }

    return result;
  } catch (error) {
    console.error('Error formatting crawl results:', error);
    return 'Error: Failed to format crawl results';
  }
}

export function formatMapResults(response: any): string {
  try {
    if (!response || typeof response !== 'object') {
      return 'Error: Invalid map response format';
    }

    const output = [];
    output.push(`Site Map Results:`);
    output.push(`Base URL: ${sanitizeText(response.base_url, 500)}`);
    output.push('\nMapped Pages:');

    if (Array.isArray(response.results)) {
      response.results.slice(0, 50).forEach((page: any, index: number) => {
        const pageUrl = typeof page === 'string' ? page : page.url || page;
        output.push(`\n[${index + 1}] URL: ${sanitizeText(pageUrl, 500)}`);
      });
    }

    const result = output.join('\n');

    // 限制总输出大小
    if (result.length > 20000) {
      return result.substring(0, 20000) + '\n\n... [站点地图过长，已截断]';
    }

    return result;
  } catch (error) {
    console.error('Error formatting map results:', error);
    return 'Error: Failed to format map results';
  }
}

class TavilyMCPServer {
  private server: Server;
  private tavilyClient: TavilyClient;

  // 全局请求锁，防止并发竞争条件
  private globalRequestLock = false;
  private requestQueue: Array<() => Promise<void>> = [];

  constructor() {
    // 从环境变量读取API密钥
    const apiKeysString = process.env.TAVILY_API_KEYS || process.env.TAVILY_API_KEY;
    if (!apiKeysString) {
      throw new Error('TAVILY_API_KEYS or TAVILY_API_KEY environment variable is required');
    }

    // 支持多个密钥，用逗号分隔
    const apiKeys = apiKeysString.split(',').map(key => key.trim()).filter(key => key);
    
    if (apiKeys.length === 0) {
      throw new Error('At least one valid API key is required');
    }

    console.error(`Initialized with ${apiKeys.length} API key(s)`);
    
    this.tavilyClient = new TavilyClient(apiKeys);
    this.server = new Server(
      {
        name: 'tavily-mcp-loadbalancer',
        version: '1.0.0',
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  // 设置错误处理和连接稳定性
  private setupErrorHandling() {
    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      console.error(`[${new Date().toISOString()}] [ERROR] Uncaught exception:`, error);
      // 不退出进程，继续运行
    });

    // 处理未处理的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
      console.error(`[${new Date().toISOString()}] [ERROR] Unhandled rejection at:`, promise, 'reason:', reason);
      // 不退出进程，继续运行
    });

    // 设置服务器错误处理
    this.server.onerror = (error) => {
      console.error(`[${new Date().toISOString()}] [ERROR] Server error:`, error);
      // 不抛出错误，继续运行
    };
  }

  // 请求序列化方法，防止并发竞争条件
  private async executeWithLock<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeOperation = async () => {
        try {
          console.error(`[${new Date().toISOString()}] [LOCK] Acquiring lock, queue size: ${this.requestQueue.length}`);
          this.globalRequestLock = true;
          const result = await operation();
          console.error(`[${new Date().toISOString()}] [LOCK] Operation completed successfully`);
          resolve(result);
        } catch (error) {
          console.error(`[${new Date().toISOString()}] [LOCK] Operation failed:`, error);
          reject(error);
        } finally {
          this.globalRequestLock = false;
          console.error(`[${new Date().toISOString()}] [LOCK] Lock released, queue size: ${this.requestQueue.length}`);
          // 处理队列中的下一个请求
          const nextOperation = this.requestQueue.shift();
          if (nextOperation) {
            console.error(`[${new Date().toISOString()}] [LOCK] Processing next queued operation`);
            setTimeout(nextOperation, 10); // 小延迟避免竞争
          }
        }
      };

      if (this.globalRequestLock) {
        // 如果有锁，加入队列
        console.error(`[${new Date().toISOString()}] [LOCK] Lock busy, adding to queue (size: ${this.requestQueue.length + 1})`);
        this.requestQueue.push(executeOperation);
      } else {
        // 立即执行
        console.error(`[${new Date().toISOString()}] [LOCK] Lock available, executing immediately`);
        executeOperation();
      }
    });
  }

  // Helper method to handle search functionality
  private async handleSearch(args: any) {
    const searchParams: TavilySearchParams = {
      query: args?.query as string,
      search_depth: (args?.search_depth as 'basic' | 'advanced') || 'basic',
      topic: (args?.topic as 'general' | 'news') || 'general',
      days: (args?.days as number) || 3,
      time_range: args?.time_range as 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y',
      start_date: args?.start_date as string,
      end_date: args?.end_date as string,
      max_results: (args?.max_results as number) || 10,
      include_images: (args?.include_images as boolean) || false,
      include_image_descriptions: (args?.include_image_descriptions as boolean) || false,
      include_raw_content: (args?.include_raw_content as boolean) || false,
      include_domains: Array.isArray(args?.include_domains) ? args.include_domains : [],
      exclude_domains: Array.isArray(args?.exclude_domains) ? args.exclude_domains : [],
      country: args?.country as string,
      include_favicon: (args?.include_favicon as boolean) || false
    };

    const result = await this.tavilyClient.search(searchParams);

    return {
      content: [
        {
          type: 'text',
          text: formatResults(result),
        },
      ],
    };
  }

  private setupHandlers() {
    // Create common search tool schema
    const searchToolSchema = {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query"
        },
        search_depth: {
          type: "string",
          enum: ["basic", "advanced"],
          description: "The depth of the search. It can be 'basic' or 'advanced'",
          default: "basic"
        },
        topic: {
          type: "string",
          enum: ["general", "news"],
          description: "The category of the search. This will determine which of our agents will be used for the search",
          default: "general"
        },
        days: {
          type: "number",
          description: "The number of days back from the current date to include in the search results. This specifies the time frame of data to be retrieved. Please note that this feature is only available when using the 'news' search topic",
          default: 3
        },
        time_range: {
          type: "string",
          description: "The time range back from the current date to include in the search results. This feature is available for both 'general' and 'news' search topics",
          enum: ["day", "week", "month", "year", "d", "w", "m", "y"]
        },
        max_results: {
          type: "number",
          description: "The maximum number of search results to return",
          default: 10,
          minimum: 5,
          maximum: 20
        },
        include_images: {
          type: "boolean",
          description: "Include a list of query-related images in the response",
          default: false
        },
        include_image_descriptions: {
          type: "boolean",
          description: "Include a list of query-related images and their descriptions in the response",
          default: false
        },
        include_raw_content: {
          type: "boolean",
          description: "Include the cleaned and parsed HTML content of each search result",
          default: false
        },
        include_domains: {
          type: "array",
          items: { type: "string" },
          description: "A list of domains to specifically include in the search results, if the user asks to search on specific sites set this to the domain of the site",
          default: []
        },
        exclude_domains: {
          type: "array",
          items: { type: "string" },
          description: "List of domains to specifically exclude, if the user asks to exclude a domain set this to the domain of the site",
          default: []
        },
        start_date: {
          type: "string",
          description: "Will return all results after the specified start date. Required to be written in the format YYYY-MM-DD.",
          default: ""
        },
        end_date: {
          type: "string",
          description: "Will return all results before the specified end date. Required to be written in the format YYYY-MM-DD",
          default: ""
        },
        country: {
          type: "string",
          description: "Boost search results from a specific country. This will prioritize content from the selected country in the search results. Available only if topic is general. Country names MUST be written in lowercase, plain English, with spaces and no underscores.",
          default: ""
        },
        include_favicon: {
          type: "boolean",
          description: "Whether to include the favicon URL for each result",
          default: false
        }
      },
      required: ["query"]
    };

    const searchToolDescription = "A powerful web search tool that provides comprehensive, real-time results using Tavily's AI search engine. Returns relevant web content with customizable parameters for result count, content type, and domain filtering. Ideal for gathering current information, news, and detailed web content analysis.";

    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "tavily-search",
            description: searchToolDescription,
            inputSchema: searchToolSchema
          } as Tool,
          {
            name: "search",
            description: searchToolDescription,
            inputSchema: searchToolSchema
          } as Tool,
          {
            name: "tavily-extract",
            description: "A powerful web content extraction tool that retrieves and processes raw content from specified URLs, ideal for data collection, content analysis, and research tasks.",
            inputSchema: {
              type: "object",
              properties: {
                urls: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of URLs to extract content from"
                },
                extract_depth: {
                  type: "string",
                  enum: ["basic", "advanced"],
                  description: "Depth of extraction - 'basic' or 'advanced', if urls are linkedin use 'advanced' or if explicitly told to use advanced",
                  default: "basic"
                },
                include_images: {
                  type: "boolean",
                  description: "Include a list of images extracted from the urls in the response",
                  default: false
                },
                format: {
                  type: "string",
                  enum: ["markdown", "text"],
                  description: "The format of the extracted web page content. markdown returns content in markdown format. text returns plain text and may increase latency.",
                  default: "markdown"
                },
                include_favicon: {
                  type: "boolean",
                  description: "Whether to include the favicon URL for each result",
                  default: false
                }
              },
              required: ["urls"]
            }
          } as Tool,
          {
            name: "tavily-crawl",
            description: "A powerful web crawler that initiates a structured web crawl starting from a specified base URL. The crawler expands from that point like a tree, following internal links across pages. You can control how deep and wide it goes, and guide it to focus on specific sections of the site.",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "The root URL to begin the crawl"
                },
                max_depth: {
                  type: "integer",
                  description: "Max depth of the crawl. Defines how far from the base URL the crawler can explore.",
                  default: 1,
                  minimum: 1
                },
                max_breadth: {
                  type: "integer",
                  description: "Max number of links to follow per level of the tree (i.e., per page)",
                  default: 20,
                  minimum: 1
                },
                limit: {
                  type: "integer",
                  description: "Total number of links the crawler will process before stopping",
                  default: 50,
                  minimum: 1
                },
                instructions: {
                  type: "string",
                  description: "Natural language instructions for the crawler"
                },
                select_paths: {
                  type: "array",
                  items: { type: "string" },
                  description: "Regex patterns to select only URLs with specific path patterns (e.g., /docs/.*, /api/v1.*)",
                  default: []
                },
                select_domains: {
                  type: "array",
                  items: { type: "string" },
                  description: "Regex patterns to select crawling to specific domains or subdomains (e.g., ^docs\\.example\\.com$)",
                  default: []
                },
                allow_external: {
                  type: "boolean",
                  description: "Whether to allow following links that go to external domains",
                  default: false
                },
                categories: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ["Careers", "Blog", "Documentation", "About", "Pricing", "Community", "Developers", "Contact", "Media"]
                  },
                  description: "Filter URLs using predefined categories like documentation, blog, api, etc",
                  default: []
                },
                extract_depth: {
                  type: "string",
                  enum: ["basic", "advanced"],
                  description: "Advanced extraction retrieves more data, including tables and embedded content, with higher success but may increase latency",
                  default: "basic"
                }
              },
              required: ["url"]
            }
          } as Tool,
          {
            name: "tavily-map",
            description: "A powerful web mapping tool that creates a structured map of website URLs, allowing you to discover and analyze site structure, content organization, and navigation paths. Perfect for site audits, content discovery, and understanding website architecture.",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "The root URL to begin the mapping"
                },
                max_depth: {
                  type: "integer",
                  description: "Max depth of the mapping. Defines how far from the base URL the crawler can explore",
                  default: 1,
                  minimum: 1
                },
                max_breadth: {
                  type: "integer",
                  description: "Max number of links to follow per level of the tree (i.e., per page)",
                  default: 20,
                  minimum: 1
                },
                limit: {
                  type: "integer",
                  description: "Total number of links the crawler will process before stopping",
                  default: 50,
                  minimum: 1
                },
                instructions: {
                  type: "string",
                  description: "Natural language instructions for the crawler"
                },
                select_paths: {
                  type: "array",
                  items: { type: "string" },
                  description: "Regex patterns to select only URLs with specific path patterns (e.g., /docs/.*, /api/v1.*)",
                  default: []
                },
                select_domains: {
                  type: "array",
                  items: { type: "string" },
                  description: "Regex patterns to select crawling to specific domains or subdomains (e.g., ^docs\\.example\\.com$)",
                  default: []
                },
                allow_external: {
                  type: "boolean",
                  description: "Whether to allow following links that go to external domains",
                  default: false
                },
                categories: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ["Careers", "Blog", "Documentation", "About", "Pricing", "Community", "Developers", "Contact", "Media"]
                  },
                  description: "Filter URLs using predefined categories like documentation, blog, api, etc",
                  default: []
                },
                extract_depth: {
                  type: "string",
                  enum: ["basic", "advanced"],
                  description: "Advanced extraction retrieves more data, including tables and embedded content, with higher success but may increase latency",
                  default: "basic"
                },
                format: {
                  type: "string",
                  enum: ["markdown", "text"],
                  description: "The format of the extracted web page content. markdown returns content in markdown format. text returns plain text and may increase latency.",
                  default: "markdown"
                },
                include_favicon: {
                  type: "boolean",
                  description: "Whether to include the favicon URL for each result",
                  default: false
                }
              },
              required: ["url"]
            }
          } as Tool,
          {
            name: "tavily-map",
            description: "A powerful web mapping tool that creates a structured map of website URLs, allowing you to discover and analyze site structure, content organization, and navigation paths. Perfect for site audits, content discovery, and understanding website architecture.",
            inputSchema: {
              type: "object",
              properties: {
                url: {
                  type: "string",
                  description: "The root URL to begin the mapping"
                },
                max_depth: {
                  type: "integer",
                  description: "Max depth of the mapping. Defines how far from the base URL the crawler can explore",
                  default: 1,
                  minimum: 1
                },
                max_breadth: {
                  type: "integer",
                  description: "Max number of links to follow per level of the tree (i.e., per page)",
                  default: 20,
                  minimum: 1
                },
                limit: {
                  type: "integer",
                  description: "Total number of links the crawler will process before stopping",
                  default: 50,
                  minimum: 1
                },
                instructions: {
                  type: "string",
                  description: "Natural language instructions for the crawler"
                },
                select_paths: {
                  type: "array",
                  items: { type: "string" },
                  description: "Regex patterns to select only URLs with specific path patterns (e.g., /docs/.*, /api/v1.*)",
                  default: []
                },
                select_domains: {
                  type: "array",
                  items: { type: "string" },
                  description: "Regex patterns to select crawling to specific domains or subdomains (e.g., ^docs\\.example\\.com$)",
                  default: []
                },
                allow_external: {
                  type: "boolean",
                  description: "Whether to allow following links that go to external domains",
                  default: false
                },
                categories: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ["Careers", "Blog", "Documentation", "About", "Pricing", "Community", "Developers", "Contact", "Media"]
                  },
                  description: "Filter URLs using predefined categories like documentation, blog, api, etc",
                  default: []
                }
              },
              required: ["url"]
            }
          } as Tool,
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      logWithTimestamp('INFO', `Tool called: ${name}`, { args: args ? Object.keys(args) : [] });

      try {
        // 直接执行工具，不使用全局锁和复杂的重试机制
        const result = await this.executeToolDirectly(name, args);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logWithTimestamp('ERROR', `Tool ${name} failed:`, errorMessage);

        return {
          content: [
            {
              type: 'text',
              text: `Error: ${sanitizeText(errorMessage, 500)}`,
            },
          ],
        };
      }
    });
  }

  // 直接执行工具的方法，不使用全局锁
  private async executeToolDirectly(name: string, args: any): Promise<any> {
    switch (name) {
      case 'tavily-search':
      case 'search': {
        const query = args?.query ? String(args.query).substring(0, 100) : 'undefined';
        logWithTimestamp('INFO', `Executing search with query: ${query}`);
        const result = await this.handleSearch(args);
        logWithTimestamp('INFO', `Search completed successfully, response size: ${JSON.stringify(result).length} bytes`);
        return result;
      }

      case 'tavily-extract': {
        const urlCount = Array.isArray(args?.urls) ? args.urls.length : 0;
        logWithTimestamp('INFO', `Executing extract for ${urlCount} URLs`);
        const extractParams: TavilyExtractParams = {
          urls: Array.isArray(args?.urls) ? args.urls : [],
          extract_depth: (args?.extract_depth as 'basic' | 'advanced') || 'basic',
          include_images: (args?.include_images as boolean) || false,
          format: (args?.format as 'markdown' | 'text') || 'markdown',
          include_favicon: (args?.include_favicon as boolean) || false
        };

        const extractResult = await this.tavilyClient.extract(extractParams);
        const formattedResult = formatResults(extractResult);
        logWithTimestamp('INFO', `Extract completed, response size: ${formattedResult.length} bytes`);

        return {
          content: [
            {
              type: 'text',
              text: formattedResult,
            },
          ],
        };
      }

      case 'tavily-crawl': {
        const crawlParams: TavilyCrawlParams = {
          url: args?.url as string,
          max_depth: (args?.max_depth as number) || 1,
          max_breadth: (args?.max_breadth as number) || 20,
          limit: (args?.limit as number) || 50,
          instructions: args?.instructions as string,
          select_paths: Array.isArray(args?.select_paths) ? args.select_paths : [],
          select_domains: Array.isArray(args?.select_domains) ? args.select_domains : [],
          allow_external: (args?.allow_external as boolean) || false,
          categories: Array.isArray(args?.categories) ? args.categories : [],
          extract_depth: (args?.extract_depth as 'basic' | 'advanced') || 'basic',
          format: (args?.format as 'markdown' | 'text') || 'markdown',
          include_favicon: (args?.include_favicon as boolean) || false
        };

        const crawlResult = await this.tavilyClient.crawl(crawlParams);

        return {
          content: [
            {
              type: 'text',
              text: formatCrawlResults(crawlResult),
            },
          ],
        };
      }

      case 'tavily-map': {
        const mapParams: TavilyMapParams = {
          url: args?.url as string,
          max_depth: (args?.max_depth as number) || 1,
          max_breadth: (args?.max_breadth as number) || 20,
          limit: (args?.limit as number) || 50,
          instructions: args?.instructions as string,
          select_paths: Array.isArray(args?.select_paths) ? args.select_paths : [],
          select_domains: Array.isArray(args?.select_domains) ? args.select_domains : [],
          allow_external: (args?.allow_external as boolean) || false,
          categories: Array.isArray(args?.categories) ? args.categories : []
        };

        const mapResult = await this.tavilyClient.map(mapParams);

        return {
          content: [
            {
              type: 'text',
              text: formatMapResults(mapResult),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }


  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Tavily MCP Load Balancer Server running on stdio');
    
    // 等待连接关闭
    return new Promise<void>((resolve) => {
      process.on('SIGINT', () => {
        console.error('Received SIGINT, shutting down gracefully');
        resolve();
      });
      
      process.on('SIGTERM', () => {
        console.error('Received SIGTERM, shutting down gracefully');
        resolve();
      });
    });
  }
}

async function main() {
  try {
    console.error('Starting Tavily MCP Load Balancer Server...');
    const server = new TavilyMCPServer();
    console.error('Server instance created, connecting...');
    await server.run();
    console.error('Server stopped');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 直接运行main函数
main().catch(console.error);

export { TavilyMCPServer };