#!/usr/bin/env node

import { SSEMCPServer } from './sse-server.js';
import dotenv from 'dotenv';

dotenv.config();

function logWithTimestamp(level: string, message: string, ...args: any[]) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`, ...args);
}

async function main() {
  try {
    logWithTimestamp('INFO', '正在启动 Tavily SSE MCP 服务器...');

    // 获取配置
    const port = parseInt(process.env.SUPERGATEWAY_PORT || '60002');
    logWithTimestamp('INFO', `端口: ${port}`);

    // 获取API密钥
    const apiKeysString = process.env.TAVILY_API_KEYS || process.env.TAVILY_API_KEY;
    if (!apiKeysString) {
      logWithTimestamp('ERROR', '未找到API密钥，请设置 TAVILY_API_KEYS 或 TAVILY_API_KEY 环境变量');
      process.exit(1);
    }

    const apiKeys = apiKeysString.split(',').map(key => key.trim()).filter(key => key);
    logWithTimestamp('INFO', `已加载 ${apiKeys.length} 个API密钥`);

    // 创建并启动SSE服务器
    const server = new SSEMCPServer(apiKeys, port);
    await server.start();

    // 优雅关闭处理
    const shutdown = async (signal: string) => {
      logWithTimestamp('INFO', `收到 ${signal} 信号，正在优雅关闭...`);
      try {
        await server.stop();
        logWithTimestamp('INFO', '服务器已关闭');
        process.exit(0);
      } catch (error) {
        logWithTimestamp('ERROR', '关闭服务器时出错:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (error) {
    logWithTimestamp('ERROR', '启动服务器失败:', error);
    process.exit(1);
  }
}

main();