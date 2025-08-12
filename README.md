# Tavily MCP Load Balancer

[![Docker Hub](https://img.shields.io/docker/pulls/yatotm1994/tavily-mcp-loadbalancer?style=flat-square)](https://hub.docker.com/r/yatotm1994/tavily-mcp-loadbalancer)
[![Docker Image Size](https://img.shields.io/docker/image-size/yatotm1994/tavily-mcp-loadbalancer?style=flat-square)](https://hub.docker.com/r/yatotm1994/tavily-mcp-loadbalancer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Language / 语言**: [English](./README_EN.md) | [中文](./README.md)

一个支持多API密钥负载均衡的Tavily MCP服务器，提供原生SSE接口，可以自动轮询使用多个API密钥，提供高可用性和更高的请求限制。

<details>
<summary>📋 更新日志</summary>

### v2.0.0 (2025-08-12)
- 🔄 **架构重构**: 从supergateway依赖改为原生SSE实现
- 🛠️ **工具更新**: 同步最新Tavily MCP工具集，新增tavily-crawl和tavily-map
- 📊 **监控增强**: 添加详细的API密钥使用日志和轮询状态
- 🔒 **安全改进**: 增强响应数据清理和字符编码处理
- 📝 **文档重写**: 完全重写README，优化项目结构

### v1.0.0 (2025-08-05)
- 🚀 **初始版本**: 基于supergateway的Tavily MCP负载均衡器
- 🔄 **负载均衡**: 实现多API密钥轮询机制
- 🛡️ **故障转移**: 自动禁用失效密钥功能

</details>

## ✨ 功能特性

- 🔄 **智能负载均衡**: 自动轮询多个API密钥，提升并发能力
- 🛡️ **自动故障转移**: 智能检测并禁用失效密钥
- 🌐 **原生SSE支持**: 内置SSE服务器，无需外部依赖
- 🛠️ **完整工具集**: 支持搜索、提取、爬虫、地图等全套Tavily工具
- 📊 **实时监控**: 详细的密钥使用日志和性能统计
- 🔒 **数据安全**: 自动清理和验证响应数据
- ⚡ **高性能**: 基于TypeScript和现代Node.js架构

## 🚀 快速开始

### Docker 部署（推荐）

```bash
# 使用 Docker Hub 镜像快速启动
docker run -d \
  --name tavily-mcp-lb \
  -p 60002:60002 \
  -e TAVILY_API_KEYS="your-key1,your-key2,your-key3" \
  yatotm1994/tavily-mcp-loadbalancer:latest
```

### 本地开发

```bash
# 1. 克隆并安装
git clone https://github.com/yatotm/tavily-mcp-loadbalancer.git
cd tavily-mcp-loadbalancer
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，添加你的 API 密钥

# 3. 启动服务
npm run build-and-start
```

**服务启动后访问：**
- SSE接口: `http://localhost:60002/sse`
- 健康检查: `http://localhost:60002/health`

<details>
<summary>📦 更多部署方式</summary>

#### Docker Compose 部署

```bash
# 1. 克隆项目
git clone https://github.com/yatotm/tavily-mcp-loadbalancer.git
cd tavily-mcp-loadbalancer

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 3. 启动服务
docker-compose up -d

# 4. 查看日志
docker-compose logs -f
```

#### 自定义 Docker 构建

```bash
# 构建镜像
docker build -t tavily-mcp-loadbalancer .

# 运行容器
docker run -d \
  --name tavily-mcp-lb \
  -p 60002:60002 \
  -e TAVILY_API_KEYS="your-key1,your-key2,your-key3" \
  tavily-mcp-loadbalancer
```

#### 开发模式

```bash
# 开发模式运行（热重载）
npm run dev

# 分步执行
npm run build
npm run start-gateway

# 使用脚本启动
./start.sh
```

</details>



## 🛠️ 可用工具

本服务器提供5个Tavily工具，支持搜索、内容提取、网站爬虫等功能：

| 工具名称 | 功能描述 | 主要参数 |
|---------|---------|---------|
| `search` / `tavily-search` | 网络搜索 | query, max_results, search_depth |
| `tavily-extract` | 网页内容提取 | urls, extract_depth, format |
| `tavily-crawl` | 网站爬虫 | url, max_depth, limit |
| `tavily-map` | 网站地图生成 | url, max_depth, max_breadth |

<details>
<summary>📖 详细工具文档</summary>

### 接口说明

**SSE接口**: `http://localhost:60002/sse`
**消息接口**: `http://localhost:60002/message`
**健康检查**: `http://localhost:60002/health`

### 工具参数详解

#### 1. search / tavily-search - 网络搜索
```json
{
  "name": "search",
  "arguments": {
    "query": "OpenAI GPT-4",
    "search_depth": "basic",
    "topic": "general",
    "max_results": 10,
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "country": "US",
    "include_favicon": false
  }
}
```

#### 2. tavily-extract - 网页内容提取
```json
{
  "name": "tavily-extract",
  "arguments": {
    "urls": ["https://example.com/article"],
    "extract_depth": "basic",
    "format": "markdown",
    "include_favicon": false
  }
}
```

#### 3. tavily-crawl - 网站爬虫
```json
{
  "name": "tavily-crawl",
  "arguments": {
    "url": "https://example.com",
    "max_depth": 2,
    "max_breadth": 20,
    "limit": 50,
    "instructions": "Focus on technical content",
    "select_paths": ["/docs", "/api"],
    "select_domains": ["example.com"],
    "allow_external": false,
    "categories": ["technology"],
    "extract_depth": "basic",
    "format": "markdown",
    "include_favicon": false
  }
}
```

#### 4. tavily-map - 网站地图生成
```json
{
  "name": "tavily-map",
  "arguments": {
    "url": "https://example.com",
    "max_depth": 1,
    "max_breadth": 20,
    "limit": 50,
    "instructions": "Map the main structure",
    "select_paths": ["/"],
    "select_domains": ["example.com"],
    "allow_external": false,
    "categories": ["general"]
  }
}
```

### 直接MCP使用

```bash
# 直接使用MCP协议（stdio）
node dist/index.js
```

</details>

## 📊 监控和测试

### 快速测试

```bash
# 测试服务器状态
./manage.sh stats

# 测试所有工具
./manage.sh test

# 批量测试API密钥
./manage.sh weather
```

<details>
<summary>🔧 详细测试和监控</summary>

### 管理脚本

```bash
# 测试服务器连接状态
./manage.sh stats

# 测试所有工具功能
./manage.sh test

# 批量测试天气搜索（测试所有API密钥）
./manage.sh weather

# 显示帮助信息
./manage.sh help
```

### Node.js 测试脚本

```bash
# 测试服务器连接
node check_stats_direct.cjs

# 运行工具测试
node test_tools_direct.cjs

# 批量天气搜索测试
node test_weather_search.cjs

# 测试SSE连接和数据安全性
node test_sse_validation.cjs
```

### 监控输出示例

#### 服务器状态检查
```
✅ 连接成功
📊 Tavily MCP 负载均衡器状态:
✅ 搜索功能正常
搜索结果长度: 2847 字符
```

#### API密钥轮询日志
```
[INFO] Using API key: tvly-dev-T... (Key 1/10)
[INFO] API key tvly-dev-T... request successful
[INFO] Using API key: tvly-dev-Y... (Key 2/10)
[INFO] API key tvly-dev-Y... request successful
```

</details>



## ⚙️ 配置

### 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|---------|
| `TAVILY_API_KEYS` | API密钥列表（逗号分隔） | 必填 |
| `TAVILY_API_KEY` | 单个API密钥 | 可选 |
| `SUPERGATEWAY_PORT` | 服务端口 | 60002 |

### 配置示例

```bash
# .env 文件
TAVILY_API_KEYS=tvly-dev-key1,tvly-dev-key2,tvly-dev-key3
SUPERGATEWAY_PORT=60002
```

<details>
<summary>🔧 高级配置</summary>

### Docker 环境变量

```bash
# Docker 运行时设置
docker run -e "TAVILY_API_KEYS=key1,key2,key3" \
           -e "SUPERGATEWAY_PORT=60002" \
           yatotm1994/tavily-mcp-loadbalancer:latest
```

### 开发环境配置

```bash
# 开发环境变量
export TAVILY_API_KEYS="tvly-dev-key1,tvly-dev-key2"
export SUPERGATEWAY_PORT=60002

# 或使用 .env 文件
cp .env.example .env
# 编辑 .env 文件
```

### SSE连接测试

验证SSE连接和数据安全性：

```bash
# 运行SSE连接测试
node test_sse_validation.cjs
```

测试内容：
- ✅ SSE连接建立和会话管理
- ✅ JSON-RPC消息发送和接收
- ✅ 响应数据安全性验证
- ✅ 控制字符和特殊字符处理
- ✅ 大数据响应处理
- ✅ 错误处理和日志记录

</details>





## 🔧 故障排除

### 常见问题

| 问题 | 解决方案 |
|------|---------|
| 无可用API密钥 | 检查 `TAVILY_API_KEYS` 环境变量 |
| 连接超时 | 检查网络和防火墙设置 |
| 端口被占用 | 使用 `lsof -i :60002` 检查端口 |
| SSE连接失败 | 运行 `node test_sse_validation.cjs` |

### 快速诊断

```bash
# 检查服务状态
curl http://localhost:60002/health

# 测试连接
node check_stats_direct.cjs

# 查看日志
docker logs tavily-mcp-lb
```

<details>
<summary>🔍 详细故障排除</summary>

### 本地运行问题

1. **No available API keys**
   - 检查环境变量：`echo $TAVILY_API_KEYS`
   - 确保密钥格式正确（以`tvly-`开头）
   - 使用 `node check_stats_direct.cjs` 测试连接

2. **API密钥错误或被禁用**
   - 查看服务器日志中的错误信息
   - 使用 `./manage.sh weather` 批量测试所有密钥
   - 检查密钥配额是否用完

3. **连接超时或网络问题**
   - 检查网络连接和防火墙设置
   - 确认Tavily API服务是否正常
   - 尝试减少并发请求数量

4. **SSE连接问题**
   - 使用 `node test_sse_validation.cjs` 测试SSE连接
   - 检查端口60002是否被占用：`lsof -i :60002`
   - 确认服务器已正常启动

### Docker 相关问题

| 问题 | 解决方案 |
|------|---------|
| 构建失败 | `docker system prune -f` 清理缓存 |
| 容器启动失败 | `docker logs tavily-mcp-lb` 查看日志 |
| 环境变量无效 | 检查 `.env` 文件格式 |
| 健康检查失败 | `curl http://localhost:60002/health` |

### Docker 调试命令

```bash
# 查看容器日志
docker logs -f tavily-mcp-lb

# 进入容器调试
docker exec -it tavily-mcp-lb sh

# 检查环境变量
docker exec tavily-mcp-lb env | grep TAVILY
```

</details>





## 📄 许可证

MIT License

---

**⭐ 如果这个项目对你有帮助，请给个Star！**