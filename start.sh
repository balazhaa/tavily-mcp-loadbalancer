#!/bin/bash

# 启动Tavily MCP负载均衡服务器的脚本

# 检查环境变量
if [ -z "$TAVILY_API_KEYS" ] && [ -z "$TAVILY_API_KEY" ]; then
    echo "错误: 请设置 TAVILY_API_KEYS 或 TAVILY_API_KEY 环境变量"
    echo "示例: export TAVILY_API_KEYS=key1,key2,key3"
    exit 1
fi

# 默认配置
PORT=${SUPERGATEWAY_PORT:-60002}
BASE_URL=${SUPERGATEWAY_BASE_URL:-"http://0.0.0.0:$PORT"}
SSE_PATH=${SUPERGATEWAY_SSE_PATH:-"/sse"}
MESSAGE_PATH=${SUPERGATEWAY_MESSAGE_PATH:-"/message"}

echo "正在启动 Tavily MCP 负载均衡服务器..."
echo "端口: $PORT"
echo "基础URL: $BASE_URL"

# 构建项目（如果需要）
if [ ! -d "dist" ]; then
    echo "构建项目..."
    npm run build
fi

# 启动 supergateway 和我们的 MCP 服务器
exec npx -y supergateway \
  --stdio "node dist/index.js" \
  --port "$PORT" \
  --baseUrl "$BASE_URL" \
  --ssePath "$SSE_PATH" \
  --messagePath "$MESSAGE_PATH" \
  --cors