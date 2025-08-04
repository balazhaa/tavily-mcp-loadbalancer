#!/usr/bin/env node

// 直接与MCP服务器通信的监控脚本
const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 检查 Tavily MCP 负载均衡器状态...');
console.log('直接连接MCP服务器');
console.log('========================================');

// 启动MCP服务器进程
const mcpProcess = spawn('node', ['dist/index.js'], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe']
});

let responseData = '';
let hasReceivedResponse = false;

// 设置超时
const timeout = setTimeout(() => {
    if (!hasReceivedResponse) {
        console.log('❌ 请求超时');
        mcpProcess.kill();
        process.exit(1);
    }
}, 10000);

// 监听输出
mcpProcess.stdout.on('data', (data) => {
    responseData += data.toString();
    
    // 查找JSON RPC响应
    const lines = responseData.split('\n');
    for (const line of lines) {
        if (line.trim() && line.includes('"jsonrpc"')) {
            try {
                const response = JSON.parse(line.trim());
                if (response.result && response.result.content) {
                    hasReceivedResponse = true;
                    clearTimeout(timeout);
                    
                    const statsText = response.result.content[0].text;
                    const stats = JSON.parse(statsText);
                    
                    console.log('✅ 连接成功\n');
                    console.log('📊 API密钥池统计信息:');
                    console.log('========================================');
                    console.log(`总密钥数量: ${stats.total}`);
                    console.log(`活跃密钥数量: ${stats.active}\n`);
                    console.log('📋 密钥详情:');
                    console.log('----------------------------------------');
                    
                    stats.keys.forEach(key => {
                        const status = key.active ? '🟢 活跃' : '🔴 禁用';
                        console.log(`🔑 密钥: ${key.key}`);
                        console.log(`   状态: ${status}`);
                        console.log(`   错误次数: ${key.errorCount}/${key.maxErrors}`);
                        console.log(`   最后使用: ${key.lastUsed}`);
                        console.log(`   权重: ${key.weight}\n`);
                    });
                    
                    console.log('========================================');
                    console.log('💡 提示: 如果某个密钥被禁用，请检查密钥是否有效');
                    console.log('🔄 重启服务器会重置所有密钥状态');
                    
                    mcpProcess.kill();
                    process.exit(0);
                }
            } catch (e) {
                // 忽略解析错误，继续等待
            }
        }
    }
});

mcpProcess.stderr.on('data', (data) => {
    // 忽略stderr输出，只关注JSON响应
});

mcpProcess.on('close', (code) => {
    if (!hasReceivedResponse) {
        console.log('❌ 无法获取统计信息');
        process.exit(1);
    }
});

mcpProcess.on('error', (error) => {
    console.log('❌ 启动MCP服务器失败:', error.message);
    process.exit(1);
});

// 发送获取统计信息的请求
const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
        name: "tavily_get_stats",
        arguments: {}
    }
};

mcpProcess.stdin.write(JSON.stringify(request) + '\n');
mcpProcess.stdin.end();