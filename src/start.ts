#!/usr/bin/env node

import { spawn } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

// 检查环境变量
if (!process.env.TAVILY_API_KEYS && !process.env.TAVILY_API_KEY) {
  console.error('错误: 请设置 TAVILY_API_KEYS 或 TAVILY_API_KEY 环境变量');
  console.error('示例: export TAVILY_API_KEYS=key1,key2,key3');
  process.exit(1);
}

// 默认配置
const port = process.env.SUPERGATEWAY_PORT || '60002';
const baseUrl = process.env.SUPERGATEWAY_BASE_URL || `http://0.0.0.0:${port}`;
const ssePath = process.env.SUPERGATEWAY_SSE_PATH || '/sse';
const messagePath = process.env.SUPERGATEWAY_MESSAGE_PATH || '/message';

console.log('正在启动 Tavily MCP 负载均衡服务器...');
console.log('端口:', port);
console.log('基础URL:', baseUrl);

// 启动 supergateway
const args = [
  '-y', 'supergateway',
  '--stdio', 'node dist/index.js',
  '--port', port,
  '--baseUrl', baseUrl,
  '--ssePath', ssePath,
  '--messagePath', messagePath,
  '--cors'
];

const child = spawn('npx', args, {
  stdio: 'inherit',
  env: process.env
});

child.on('close', (code) => {
  console.log(`进程退出，代码: ${code}`);
  process.exit(code || 0);
});

child.on('error', (error) => {
  console.error('启动失败:', error);
  process.exit(1);
});