import express from 'express';
import cors from 'cors';
import { TavilyClient } from './tavilyClient';
import { formatResults, formatCrawlResults, formatMapResults, logWithTimestamp, sanitizeText } from './index';

interface SSEClient {
  sessionId: string;
  res: express.Response;
  lastActivity: number;
}

interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: any;
}

export class SSEMCPServer {
  private app: express.Application;
  private clients: Map<string, SSEClient> = new Map();
  private tavilyClient: TavilyClient;
  private port: number;
  private server: any;

  constructor(apiKeys: string[], port: number = 60002) {
    this.port = port;
    this.app = express();

    if (apiKeys.length === 0) {
      throw new Error('No Tavily API keys provided.');
    }

    this.tavilyClient = new TavilyClient(apiKeys);
    this.setupMiddleware();
    this.setupRoutes();
    this.setupCleanup();
  }

  private setupMiddleware() {
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
      credentials: false
    }));
    this.app.use(express.json());
  }

  private setupRoutes() {
    // SSE连接端点
    this.app.get('/sse', (req: any, res: any) => {
      const sessionId = this.generateSessionId();

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // 发送endpoint事件（符合MCP SSE标准）
      res.write(`event: endpoint\n`);
      res.write(`data: /message?sessionId=${sessionId}\n\n`);

      const client: SSEClient = {
        sessionId: sessionId,
        res,
        lastActivity: Date.now()
      };

      this.clients.set(sessionId, client);
      logWithTimestamp('INFO', `SSE client connected: ${sessionId}`);

      // 处理客户端断开
      req.on('close', () => {
        this.clients.delete(sessionId);
        logWithTimestamp('INFO', `SSE client disconnected: ${sessionId}`);
      });

      req.on('error', (error: any) => {
        logWithTimestamp('ERROR', `SSE client error: ${sessionId}`, error);
        this.clients.delete(sessionId);
      });
    });

    // 消息处理端点
    this.app.post('/message', async (req: any, res: any) => {
      try {
        const sessionId = req.query.sessionId as string;
        const mcpRequest: MCPRequest = req.body;

        if (!sessionId) {
          return res.status(400).json({ error: 'Missing sessionId parameter' });
        }

        logWithTimestamp('INFO', `Received message for session ${sessionId}:`, mcpRequest.method);

        const response = await this.handleMCPRequest(mcpRequest);

        // 只有当有响应时才发送（通知类型的消息不需要响应）
        if (response && this.clients.has(sessionId)) {
          const client = this.clients.get(sessionId)!;
          try {
            const responseStr = JSON.stringify(response);
            logWithTimestamp('INFO', `Sending response to session ${sessionId}, size: ${responseStr.length} bytes`);

            // 确保JSON字符串安全传输 - 处理所有可能导致传输中断的字符
            const safeResponseStr = this.sanitizeForSSE(responseStr);

            // 使用更安全的写入方式
            if (!client.res.destroyed && client.res.writable) {
              client.res.write(`data: ${safeResponseStr}\n\n`);
            } else {
              logWithTimestamp('WARN', `Cannot write to session ${sessionId}, connection is closed`);
            }

            client.lastActivity = Date.now();
            logWithTimestamp('INFO', `Response sent successfully to session ${sessionId}`);
          } catch (error) {
            logWithTimestamp('ERROR', `Failed to send response to session ${sessionId}:`, error);
          }
        } else if (response) {
          logWithTimestamp('WARN', `Session ${sessionId} not found, cannot send response`);
        }

        res.json({ status: 'sent' });
      } catch (error) {
        logWithTimestamp('ERROR', 'Error handling message:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // 健康检查
    this.app.get('/health', (req: any, res: any) => {
      res.json({
        status: 'ok',
        clients: this.clients.size,
        uptime: process.uptime()
      });
    });
  }

  private async handleMCPRequest(request: MCPRequest): Promise<MCPResponse | null> {
    try {
      switch (request.method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: {
                name: 'tavily-mcp-sse',
                version: '1.0.0',
                capabilities: { tools: {} }
              }
            }
          };

        case 'notifications/initialized':
          // 通知类型的消息不需要响应，返回null表示不发送响应
          return null;

        case 'tools/list':
          const toolsResponse = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: [
                {
                  name: 'tavily-search',
                  description: 'A powerful web search tool that provides comprehensive, real-time results using Tavily\'s AI search engine. Returns relevant web content with customizable parameters for result count, content type, and domain filtering. Ideal for gathering current information, news, and detailed web content analysis.',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: 'Search query'
                      },
                      search_depth: {
                        type: 'string',
                        enum: ['basic', 'advanced'],
                        description: 'The depth of the search. It can be \'basic\' or \'advanced\'',
                        default: 'basic'
                      },
                      topic: {
                        type: 'string',
                        enum: ['general', 'news'],
                        description: 'The category of the search. This will determine which of our agents will be used for the search',
                        default: 'general'
                      },
                      days: {
                        type: 'number',
                        description: 'The number of days back from the current date to include in the search results. This specifies the time frame of data to be retrieved. Please note that this feature is only available when using the \'news\' search topic',
                        default: 3
                      },
                      time_range: {
                        type: 'string',
                        description: 'The time range back from the current date to include in the search results. This feature is available for both \'general\' and \'news\' search topics',
                        enum: ['day', 'week', 'month', 'year', 'd', 'w', 'm', 'y']
                      },
                      start_date: {
                        type: 'string',
                        description: 'Will return all results after the specified start date. Required to be written in the format YYYY-MM-DD.',
                        default: ''
                      },
                      end_date: {
                        type: 'string',
                        description: 'Will return all results before the specified end date. Required to be written in the format YYYY-MM-DD',
                        default: ''
                      },
                      max_results: {
                        type: 'number',
                        description: 'The maximum number of search results to return',
                        default: 10,
                        minimum: 5,
                        maximum: 20
                      },
                      include_images: {
                        type: 'boolean',
                        description: 'Include a list of query-related images in the response',
                        default: false
                      },
                      include_image_descriptions: {
                        type: 'boolean',
                        description: 'Include a list of query-related images and their descriptions in the response',
                        default: false
                      },
                      include_raw_content: {
                        type: 'boolean',
                        description: 'Include the cleaned and parsed HTML content of each search result',
                        default: false
                      },
                      include_domains: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'A list of domains to specifically include in the search results, if the user asks to search on specific sites set this to the domain of the site',
                        default: []
                      },
                      exclude_domains: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of domains to specifically exclude, if the user asks to exclude a domain set this to the domain of the site',
                        default: []
                      },
                      country: {
                        type: 'string',
                        description: 'Boost search results from a specific country. This will prioritize content from the selected country in the search results. Available only if topic is general. Country names MUST be written in lowercase, plain English, with spaces and no underscores.',
                        default: ''
                      },
                      include_favicon: {
                        type: 'boolean',
                        description: 'Whether to include the favicon URL for each result',
                        default: false
                      }
                    },
                    required: ['query']
                  }
                },
                {
                  name: 'search',
                  description: 'A powerful web search tool that provides comprehensive, real-time results using Tavily\'s AI search engine. Returns relevant web content with customizable parameters for result count, content type, and domain filtering. Ideal for gathering current information, news, and detailed web content analysis.',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      query: {
                        type: 'string',
                        description: 'Search query'
                      },
                      search_depth: {
                        type: 'string',
                        enum: ['basic', 'advanced'],
                        description: 'The depth of the search. It can be \'basic\' or \'advanced\'',
                        default: 'basic'
                      },
                      topic: {
                        type: 'string',
                        enum: ['general', 'news'],
                        description: 'The category of the search. This will determine which of our agents will be used for the search',
                        default: 'general'
                      },
                      days: {
                        type: 'number',
                        description: 'The number of days back from the current date to include in the search results. This specifies the time frame of data to be retrieved. Please note that this feature is only available when using the \'news\' search topic',
                        default: 3
                      },
                      time_range: {
                        type: 'string',
                        description: 'The time range back from the current date to include in the search results. This feature is available for both \'general\' and \'news\' search topics',
                        enum: ['day', 'week', 'month', 'year', 'd', 'w', 'm', 'y']
                      },
                      start_date: {
                        type: 'string',
                        description: 'Will return all results after the specified start date. Required to be written in the format YYYY-MM-DD.',
                        default: ''
                      },
                      end_date: {
                        type: 'string',
                        description: 'Will return all results before the specified end date. Required to be written in the format YYYY-MM-DD',
                        default: ''
                      },
                      max_results: {
                        type: 'number',
                        description: 'The maximum number of search results to return',
                        default: 10,
                        minimum: 5,
                        maximum: 20
                      },
                      include_images: {
                        type: 'boolean',
                        description: 'Include a list of query-related images in the response',
                        default: false
                      },
                      include_image_descriptions: {
                        type: 'boolean',
                        description: 'Include a list of query-related images and their descriptions in the response',
                        default: false
                      },
                      include_raw_content: {
                        type: 'boolean',
                        description: 'Include the cleaned and parsed HTML content of each search result',
                        default: false
                      },
                      include_domains: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'A list of domains to specifically include in the search results, if the user asks to search on specific sites set this to the domain of the site',
                        default: []
                      },
                      exclude_domains: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of domains to specifically exclude, if the user asks to exclude a domain set this to the domain of the site',
                        default: []
                      },
                      country: {
                        type: 'string',
                        description: 'Boost search results from a specific country. This will prioritize content from the selected country in the search results. Available only if topic is general. Country names MUST be written in lowercase, plain English, with spaces and no underscores.',
                        default: ''
                      },
                      include_favicon: {
                        type: 'boolean',
                        description: 'Whether to include the favicon URL for each result',
                        default: false
                      }
                    },
                    required: ['query']
                  }
                },
                {
                  name: 'tavily-extract',
                  description: 'A powerful web content extraction tool that retrieves and processes raw content from specified URLs, ideal for data collection, content analysis, and research tasks.',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      urls: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of URLs to extract content from'
                      },
                      extract_depth: {
                        type: 'string',
                        enum: ['basic', 'advanced'],
                        description: 'Depth of extraction - \'basic\' or \'advanced\', if urls are linkedin use \'advanced\' or if explicitly told to use advanced',
                        default: 'basic'
                      },
                      include_images: {
                        type: 'boolean',
                        description: 'Include a list of images extracted from the urls in the response',
                        default: false
                      },
                      format: {
                        type: 'string',
                        enum: ['markdown', 'text'],
                        description: 'The format of the extracted web page content. markdown returns content in markdown format. text returns plain text and may increase latency.',
                        default: 'markdown'
                      },
                      include_favicon: {
                        type: 'boolean',
                        description: 'Whether to include the favicon URL for each result',
                        default: false
                      }
                    },
                    required: ['urls']
                  }
                },
                {
                  name: 'tavily-crawl',
                  description: 'A powerful web crawler that initiates a structured web crawl starting from a specified base URL. The crawler expands from that point like a tree, following internal links across pages. You can control how deep and wide it goes, and guide it to focus on specific sections of the site.',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      url: {
                        type: 'string',
                        description: 'The root URL to begin the crawl'
                      },
                      max_depth: {
                        type: 'number',
                        description: 'Max depth of the crawl. Defines how far from the base URL the crawler can explore.',
                        default: 1,
                        minimum: 1
                      },
                      max_breadth: {
                        type: 'number',
                        description: 'Max number of links to follow per level of the tree (i.e., per page)',
                        default: 20,
                        minimum: 1
                      },
                      limit: {
                        type: 'number',
                        description: 'Total number of links the crawler will process before stopping',
                        default: 50,
                        minimum: 1
                      },
                      instructions: {
                        type: 'string',
                        description: 'Natural language instructions for the crawler'
                      },
                      select_paths: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Regex patterns to select only URLs with specific path patterns (e.g., /docs/.*, /api/v1.*)',
                        default: []
                      },
                      select_domains: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Regex patterns to select crawling to specific domains or subdomains (e.g., ^docs\\.example\\.com$)',
                        default: []
                      },
                      allow_external: {
                        type: 'boolean',
                        description: 'Whether to allow following links that go to external domains',
                        default: false
                      },
                      categories: {
                        type: 'array',
                        items: {
                          type: 'string',
                          enum: ['Careers', 'Blog', 'Documentation', 'About', 'Pricing', 'Community', 'Developers', 'Contact', 'Media']
                        },
                        description: 'Filter URLs using predefined categories like documentation, blog, api, etc',
                        default: []
                      },
                      extract_depth: {
                        type: 'string',
                        enum: ['basic', 'advanced'],
                        description: 'Advanced extraction retrieves more data, including tables and embedded content, with higher success but may increase latency',
                        default: 'basic'
                      },
                      format: {
                        type: 'string',
                        enum: ['markdown', 'text'],
                        description: 'The format of the extracted web page content. markdown returns content in markdown format. text returns plain text and may increase latency.',
                        default: 'markdown'
                      },
                      include_favicon: {
                        type: 'boolean',
                        description: 'Whether to include the favicon URL for each result',
                        default: false
                      }
                    },
                    required: ['url']
                  }
                },
                {
                  name: 'tavily-map',
                  description: 'A powerful web mapping tool that creates a structured map of website URLs, allowing you to discover and analyze site structure, content organization, and navigation paths. Perfect for site audits, content discovery, and understanding website architecture.',
                  inputSchema: {
                    type: 'object',
                    properties: {
                      url: {
                        type: 'string',
                        description: 'The root URL to begin the mapping'
                      },
                      max_depth: {
                        type: 'number',
                        description: 'Max depth of the mapping. Defines how far from the base URL the crawler can explore',
                        default: 1,
                        minimum: 1
                      },
                      max_breadth: {
                        type: 'number',
                        description: 'Max number of links to follow per level of the tree (i.e., per page)',
                        default: 20,
                        minimum: 1
                      },
                      limit: {
                        type: 'number',
                        description: 'Total number of links the crawler will process before stopping',
                        default: 50,
                        minimum: 1
                      },
                      instructions: {
                        type: 'string',
                        description: 'Natural language instructions for the crawler'
                      },
                      select_paths: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Regex patterns to select only URLs with specific path patterns (e.g., /docs/.*, /api/v1.*)',
                        default: []
                      },
                      select_domains: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Regex patterns to select crawling to specific domains or subdomains (e.g., ^docs\\.example\\.com$)',
                        default: []
                      },
                      allow_external: {
                        type: 'boolean',
                        description: 'Whether to allow following links that go to external domains',
                        default: false
                      },
                      categories: {
                        type: 'array',
                        items: {
                          type: 'string',
                          enum: ['Careers', 'Blog', 'Documentation', 'About', 'Pricing', 'Community', 'Developers', 'Contact', 'Media']
                        },
                        description: 'Filter URLs using predefined categories like documentation, blog, api, etc',
                        default: []
                      }
                    },
                    required: ['url']
                  }
                }
              ]
            }
          };

          logWithTimestamp('INFO', `Sending tools list response with ${toolsResponse.result.tools.length} tools`);
          return toolsResponse;

        case 'tools/call':
          const { name, arguments: args } = request.params;
          const result = await this.handleToolCall(name, args);
          return {
            jsonrpc: '2.0',
            id: request.id,
            result
          };

        default:
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`
            }
          };
      }
    } catch (error) {
      logWithTimestamp('ERROR', `Error handling MCP request ${request.method}:`, error);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: `Internal error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
  }

  private async handleToolCall(name: string, args: any): Promise<any> {
    switch (name) {
      case 'tavily-search':
      case 'search':
        const query = args?.query ? String(args.query).substring(0, 100) : 'undefined';
        logWithTimestamp('INFO', `Executing search with query: ${query}`);

        const searchParams = {
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
        logWithTimestamp('INFO', `Search completed successfully, response size: ${JSON.stringify(result).length} bytes`);

        return {
          content: [
            {
              type: 'text',
              text: formatResults(result),
            },
          ],
        };

      case 'tavily-extract':
        const urlCount = Array.isArray(args?.urls) ? args.urls.length : 0;
        logWithTimestamp('INFO', `Executing extract for ${urlCount} URLs`);

        const extractParams = {
          urls: Array.isArray(args?.urls) ? args.urls : [],
          extract_depth: (args?.extract_depth as 'basic' | 'advanced') || 'basic',
          include_images: (args?.include_images as boolean) || false,
          format: (args?.format as 'markdown' | 'text') || 'markdown',
          include_favicon: (args?.include_favicon as boolean) || false
        };

        const extractResult = await this.tavilyClient.extract(extractParams);
        logWithTimestamp('INFO', `Extract completed, response size: ${JSON.stringify(extractResult).length} bytes`);

        return {
          content: [
            {
              type: 'text',
              text: formatResults(extractResult),
            },
          ],
        };

      case 'tavily-crawl':
        logWithTimestamp('INFO', `Executing crawl for URL: ${args?.url}`);

        const crawlParams = {
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
        logWithTimestamp('INFO', `Crawl completed, response size: ${JSON.stringify(crawlResult).length} bytes`);

        return {
          content: [
            {
              type: 'text',
              text: formatCrawlResults(crawlResult),
            },
          ],
        };

      case 'tavily-map':
        logWithTimestamp('INFO', `Executing map for URL: ${args?.url}`);

        const mapParams = {
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
        logWithTimestamp('INFO', `Map completed, response size: ${JSON.stringify(mapResult).length} bytes`);

        return {
          content: [
            {
              type: 'text',
              text: formatMapResults(mapResult),
            },
          ],
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  private sanitizeForSSE(jsonStr: string): string {
    try {
      // 解析JSON以确保格式正确
      const jsonObj = JSON.parse(jsonStr);

      // 如果有content字段，清理其中的文本
      if (jsonObj.result && jsonObj.result.content && Array.isArray(jsonObj.result.content)) {
        jsonObj.result.content = jsonObj.result.content.map((item: any) => {
          if (item.text) {
            // 清理可能导致传输问题的字符
            item.text = item.text
              .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // 移除控制字符
              .replace(/[\uFEFF\uFFFE\uFFFF]/g, '') // 移除BOM和其他特殊字符
              .replace(/\\/g, '\\\\') // 转义反斜杠
              .replace(/"/g, '\\"') // 转义双引号
              .replace(/\n/g, '\\n') // 转义换行符
              .replace(/\r/g, '\\r') // 转义回车符
              .replace(/\t/g, '\\t'); // 转义制表符
          }
          return item;
        });
      }

      // 重新序列化为JSON
      return JSON.stringify(jsonObj);
    } catch (error) {
      logWithTimestamp('ERROR', 'Failed to sanitize JSON for SSE:', error);
      // 如果解析失败，至少做基本的字符清理
      return jsonStr
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
        .replace(/[\uFEFF\uFFFE\uFFFF]/g, '')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
    }
  }

  private truncateResponse(response: any, maxLength: number): any {
    try {
      if (response && response.result && response.result.content && Array.isArray(response.result.content)) {
        const content = response.result.content[0];
        if (content && content.text) {
          const originalLength = content.text.length;
          if (originalLength > maxLength) {
            const truncatedText = content.text.substring(0, maxLength) + '\n\n[响应已截断以防止传输错误]';
            return {
              ...response,
              result: {
                ...response.result,
                content: [{
                  ...content,
                  text: truncatedText
                }]
              }
            };
          }
        }
      }
      return response;
    } catch (error) {
      logWithTimestamp('ERROR', 'Error truncating response:', error);
      return response;
    }
  }

  private setupCleanup() {
    // 定期清理不活跃的连接
    setInterval(() => {
      const now = Date.now();
      const timeout = 5 * 60 * 1000; // 5分钟超时

      for (const [sessionId, client] of this.clients.entries()) {
        if (now - client.lastActivity > timeout) {
          logWithTimestamp('INFO', `Cleaning up inactive session: ${sessionId}`);
          try {
            client.res.end();
          } catch (error) {
            // 忽略错误
          }
          this.clients.delete(sessionId);
        }
      }
    }, 60000); // 每分钟检查一次
  }

  public start(): void {
    this.server = this.app.listen(this.port, '0.0.0.0', () => {
      logWithTimestamp('INFO', `SSE MCP Server listening on port ${this.port}`);
      logWithTimestamp('INFO', `SSE endpoint: http://localhost:${this.port}/sse`);
      logWithTimestamp('INFO', `Message endpoint: http://localhost:${this.port}/message`);
      logWithTimestamp('INFO', `Health endpoint: http://localhost:${this.port}/health`);
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logWithTimestamp('INFO', 'SSE MCP Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
