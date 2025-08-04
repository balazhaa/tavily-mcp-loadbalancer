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

dotenv.config();

// Result formatting functions
function formatResults(response: any): string {
  const output = [];
  
  if (response.answer) {
    output.push(`Answer: ${response.answer}`);
  }
  
  output.push('Detailed Results:');
  response.results.forEach((result: any) => {
    output.push(`\nTitle: ${result.title}`);
    output.push(`URL: ${result.url}`);
    output.push(`Content: ${result.content}`);
    if (result.raw_content) {
      output.push(`Raw Content: ${result.raw_content}`);
    }
  });
  
  if (response.images && response.images.length > 0) {
    output.push('\nImages:');
    response.images.forEach((image: any, index: number) => {
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
  
  return output.join('\n');
}

function formatCrawlResults(response: any): string {
  const output = [];
  output.push(`Crawl Results:`);
  output.push(`Base URL: ${response.base_url}`);
  output.push('\nCrawled Pages:');
  
  response.results.forEach((page: any, index: number) => {
    output.push(`\n[${index + 1}] URL: ${page.url}`);
    if (page.raw_content) {
      const contentPreview = page.raw_content.length > 200
        ? page.raw_content.substring(0, 200) + "..."
        : page.raw_content;
      output.push(`Content: ${contentPreview}`);
    }
  });
  
  return output.join('\n');
}

function formatMapResults(response: any): string {
  const output = [];
  output.push(`Site Map Results:`);
  output.push(`Base URL: ${response.base_url}`);
  output.push('\nMapped Pages:');
  
  response.results.forEach((page: any, index: number) => {
    output.push(`\n[${index + 1}] URL: ${page}`);
  });
  
  return output.join('\n');
}

class TavilyMCPServer {
  private server: Server;
  private tavilyClient: TavilyClient;

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

    console.log(`Initialized with ${apiKeys.length} API key(s)`);
    
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
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "tavily-search",
            description: "A powerful web search tool that provides comprehensive, real-time results using Tavily's AI search engine. Returns relevant web content with customizable parameters for result count, content type, and domain filtering. Ideal for gathering current information, news, and detailed web content analysis.",
            inputSchema: {
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
                }
              },
              required: ["query"]
            }
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
                }
              },
              required: ["url"]
            }
          } as Tool,
          {
            name: 'tavily_get_stats',
            description: 'Get statistics about the API key pool',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          } as Tool,
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'tavily-search': {
            const searchParams: TavilySearchParams = {
              query: args?.query as string,
              search_depth: (args?.search_depth as 'basic' | 'advanced') || 'basic',
              topic: (args?.topic as 'general' | 'news') || 'general',
              days: (args?.days as number) || 3,
              time_range: args?.time_range as 'day' | 'week' | 'month' | 'year' | 'd' | 'w' | 'm' | 'y',
              max_results: (args?.max_results as number) || 10,
              include_images: (args?.include_images as boolean) || false,
              include_image_descriptions: (args?.include_image_descriptions as boolean) || false,
              include_raw_content: (args?.include_raw_content as boolean) || false,
              include_domains: Array.isArray(args?.include_domains) ? args.include_domains : [],
              exclude_domains: Array.isArray(args?.exclude_domains) ? args.exclude_domains : []
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

          case 'tavily-extract': {
            const extractParams: TavilyExtractParams = {
              urls: Array.isArray(args?.urls) ? args.urls : [],
              extract_depth: (args?.extract_depth as 'basic' | 'advanced') || 'basic',
              include_images: (args?.include_images as boolean) || false
            };

            const result = await this.tavilyClient.extract(extractParams);
            
            return {
              content: [
                {
                  type: 'text',
                  text: formatResults(result),
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
              extract_depth: (args?.extract_depth as 'basic' | 'advanced') || 'basic'
            };

            const result = await this.tavilyClient.crawl(crawlParams);
            
            return {
              content: [
                {
                  type: 'text',
                  text: formatCrawlResults(result),
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

            const result = await this.tavilyClient.map(mapParams);
            
            return {
              content: [
                {
                  type: 'text',
                  text: formatMapResults(result),
                },
              ],
            };
          }

          case 'tavily_get_stats': {
            const stats = this.tavilyClient.getKeyPoolStats();
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(stats, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
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