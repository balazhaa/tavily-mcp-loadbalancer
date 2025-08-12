# Tavily MCP Load Balancer

[![Docker Hub](https://img.shields.io/docker/pulls/yatotm1994/tavily-mcp-loadbalancer?style=flat-square)](https://hub.docker.com/r/yatotm1994/tavily-mcp-loadbalancer)
[![Docker Image Size](https://img.shields.io/docker/image-size/yatotm1994/tavily-mcp-loadbalancer?style=flat-square)](https://hub.docker.com/r/yatotm1994/tavily-mcp-loadbalancer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Language / 语言**: [English](./README_EN.md) | [中文](./README.md)

A Tavily MCP server with multi-API key load balancing support, providing native SSE interface for automatic API key rotation, high availability, and increased request limits.

<details>
<summary>📋 Changelog</summary>

### v2.0.0 (2025-08-12)
- 🔄 **Architecture Refactor**: Migrated from supergateway dependency to native SSE implementation
- 🛠️ **Tool Updates**: Synced with latest Tavily MCP toolset, added tavily-crawl and tavily-map
- 📊 **Enhanced Monitoring**: Added detailed API key usage logs and rotation status
- 🔒 **Security Improvements**: Enhanced response data cleaning and character encoding handling
- 📝 **Documentation Rewrite**: Complete README rewrite with optimized project structure

### v1.0.0 (2025-08-05)
- 🚀 **Initial Release**: Supergateway-based Tavily MCP load balancer
- 🔄 **Load Balancing**: Implemented multi-API key rotation mechanism
- 🛡️ **Failover**: Automatic disabled key detection and failover

</details>

## ✨ Features

- 🔄 **Smart Load Balancing**: Automatic API key rotation for improved concurrency
- 🛡️ **Auto Failover**: Intelligent detection and disabling of failed keys
- 🌐 **Native SSE Support**: Built-in SSE server with no external dependencies
- 🛠️ **Complete Toolset**: Support for search, extract, crawl, map and all Tavily tools
- 📊 **Real-time Monitoring**: Detailed key usage logs and performance statistics
- 🔒 **Data Security**: Automatic response cleaning and validation
- ⚡ **High Performance**: Built on TypeScript and modern Node.js architecture

## 🚀 Quick Start

### Docker Deployment (Recommended)

```bash
# Quick start with Docker Hub image
docker run -d \
  --name tavily-mcp-lb \
  -p 60002:60002 \
  -e TAVILY_API_KEYS="your-key1,your-key2,your-key3" \
  yatotm1994/tavily-mcp-loadbalancer:latest
```

### Local Development

```bash
# 1. Clone and install
git clone https://github.com/yatotm/tavily-mcp-loadbalancer.git
cd tavily-mcp-loadbalancer
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit .env file with your API keys

# 3. Start service
npm run build-and-start
```

**After startup, access:**
- SSE Interface: `http://localhost:60002/sse`
- Health Check: `http://localhost:60002/health`

<details>
<summary>📦 More Deployment Options</summary>

#### Docker Compose Deployment

```bash
# 1. Clone project
git clone https://github.com/yatotm/tavily-mcp-loadbalancer.git
cd tavily-mcp-loadbalancer

# 2. Configure environment variables
cp .env.example .env
# Edit .env file

# 3. Start service
docker-compose up -d

# 4. View logs
docker-compose logs -f
```

#### Custom Docker Build

```bash
# Build image
docker build -t tavily-mcp-loadbalancer .

# Run container
docker run -d \
  --name tavily-mcp-lb \
  -p 60002:60002 \
  -e TAVILY_API_KEYS="your-key1,your-key2,your-key3" \
  tavily-mcp-loadbalancer
```

#### Development Mode

```bash
# Development mode with hot reload
npm run dev

# Step-by-step execution
npm run build
npm run start-gateway

# Using script
./start.sh
```

</details>

## 🛠️ Available Tools

This server provides 5 Tavily tools supporting search, content extraction, web crawling, and more:

| Tool Name | Description | Main Parameters |
|-----------|-------------|-----------------|
| `search` / `tavily-search` | Web search | query, max_results, search_depth |
| `tavily-extract` | Web content extraction | urls, extract_depth, format |
| `tavily-crawl` | Website crawler | url, max_depth, limit |
| `tavily-map` | Website sitemap generation | url, max_depth, max_breadth |

<details>
<summary>📖 Detailed Tool Documentation</summary>

### Interface Description

**SSE Interface**: `http://localhost:60002/sse`  
**Message Interface**: `http://localhost:60002/message`  
**Health Check**: `http://localhost:60002/health`

### Tool Parameter Details

#### 1. search / tavily-search - Web Search
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

#### 2. tavily-extract - Web Content Extraction
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

#### 3. tavily-crawl - Website Crawler
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

#### 4. tavily-map - Website Sitemap Generation
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

### Direct MCP Usage

```bash
# Direct MCP protocol usage (stdio)
node dist/index.js
```

</details>

## 📊 Monitoring and Testing

### Quick Testing

```bash
# Test server status
./manage.sh stats

# Test all tools
./manage.sh test

# Batch test API keys
./manage.sh weather
```

<details>
<summary>🔧 Detailed Testing and Monitoring</summary>

### Management Scripts

```bash
# Test server connection status
./manage.sh stats

# Test all tool functionality
./manage.sh test

# Batch weather search test (test all API keys)
./manage.sh weather

# Show help information
./manage.sh help
```

### Node.js Test Scripts

```bash
# Test server connection
node check_stats_direct.cjs

# Run tool tests
node test_tools_direct.cjs

# Batch weather search test
node test_weather_search.cjs

# Test SSE connection and data security
node test_sse_validation.cjs
```

### Monitoring Output Examples

#### Server Status Check
```
✅ Connection successful
📊 Tavily MCP Load Balancer Status:
✅ Search function normal
Search result length: 2847 characters
```

#### API Key Rotation Logs
```
[INFO] Using API key: tvly-dev-T... (Key 1/10)
[INFO] API key tvly-dev-T... request successful
[INFO] Using API key: tvly-dev-Y... (Key 2/10)
[INFO] API key tvly-dev-Y... request successful
```

</details>

## ⚙️ Configuration

### Environment Variables

| Variable Name | Description | Default Value |
|---------------|-------------|---------------|
| `TAVILY_API_KEYS` | API key list (comma-separated) | Required |
| `TAVILY_API_KEY` | Single API key | Optional |
| `SUPERGATEWAY_PORT` | Service port | 60002 |

### Configuration Example

```bash
# .env file
TAVILY_API_KEYS=tvly-dev-key1,tvly-dev-key2,tvly-dev-key3
SUPERGATEWAY_PORT=60002
```

<details>
<summary>🔧 Advanced Configuration</summary>

### Docker Environment Variables

```bash
# Docker runtime settings
docker run -e "TAVILY_API_KEYS=key1,key2,key3" \
           -e "SUPERGATEWAY_PORT=60002" \
           yatotm1994/tavily-mcp-loadbalancer:latest
```

### Development Environment Configuration

```bash
# Development environment variables
export TAVILY_API_KEYS="tvly-dev-key1,tvly-dev-key2"
export SUPERGATEWAY_PORT=60002

# Or use .env file
cp .env.example .env
# Edit .env file
```

### SSE Connection Testing

Verify SSE connection and data security:

```bash
# Run SSE connection test
node test_sse_validation.cjs
```

Test content:
- ✅ SSE connection establishment and session management
- ✅ JSON-RPC message sending and receiving
- ✅ Response data security validation
- ✅ Control character and special character handling
- ✅ Large data response processing
- ✅ Error handling and logging

</details>

## 🔧 Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| No available API keys | Check `TAVILY_API_KEYS` environment variable |
| Connection timeout | Check network and firewall settings |
| Port occupied | Use `lsof -i :60002` to check port |
| SSE connection failed | Run `node test_sse_validation.cjs` |

### Quick Diagnosis

```bash
# Check service status
curl http://localhost:60002/health

# Test connection
node check_stats_direct.cjs

# View logs
docker logs tavily-mcp-lb
```

<details>
<summary>🔍 Detailed Troubleshooting</summary>

### Local Runtime Issues

1. **No available API keys**
   - Check environment variables: `echo $TAVILY_API_KEYS`
   - Ensure key format is correct (should start with `tvly-`)
   - Use `node check_stats_direct.cjs` to test connection

2. **API key errors or disabled**
   - Check error information in server logs
   - Use `./manage.sh weather` to batch test all keys
   - Check if key quota is exhausted

3. **Connection timeout or network issues**
   - Check network connection and firewall settings
   - Confirm Tavily API service is normal
   - Try reducing concurrent request count

4. **SSE connection issues**
   - Use `node test_sse_validation.cjs` to test SSE connection
   - Check if port 60002 is occupied: `lsof -i :60002`
   - Confirm server has started normally

### Docker Related Issues

| Issue | Solution |
|-------|----------|
| Build failed | `docker system prune -f` to clean cache |
| Container startup failed | `docker logs tavily-mcp-lb` to view logs |
| Environment variables invalid | Check `.env` file format |
| Health check failed | `curl http://localhost:60002/health` |

### Docker Debug Commands

```bash
# View container logs
docker logs -f tavily-mcp-lb

# Enter container for debugging
docker exec -it tavily-mcp-lb sh

# Check environment variables
docker exec tavily-mcp-lb env | grep TAVILY
```

</details>

## 📄 License

MIT License

---

**⭐ If this project helps you, please give it a Star!**
