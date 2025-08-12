# 使用官方Node.js LTS版本作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装所有依赖（包括开发依赖用于构建）
RUN npm ci

# 复制源代码
COPY . .

# 构建TypeScript项目
RUN npm run build

# 清理开发依赖，只保留生产依赖
RUN npm ci --only=production && npm cache clean --force

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 修改权限
RUN chown -R nodejs:nodejs /app
USER nodejs

# 暴露端口（从README看默认是60002）
EXPOSE 60002

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const options = { host: 'localhost', port: process.env.SUPERGATEWAY_PORT || 60002, path: '/health', timeout: 2000 }; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

# 启动命令
CMD ["node", "dist/start.js"]