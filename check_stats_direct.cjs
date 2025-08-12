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

                    console.log('✅ 连接成功\n');
                    console.log('📊 Tavily MCP 负载均衡器状态:');
                    console.log('========================================');

                    if (response.result.isError) {
                        console.log('❌ 测试搜索失败');
                        console.log('错误信息:', response.result.content[0].text);
                    } else {
                        console.log('✅ 搜索功能正常');
                        const resultText = response.result.content[0].text;
                        console.log('搜索结果长度:', resultText.length, '字符');

                        // 显示结果预览
                        const preview = resultText.substring(0, 200);
                        console.log('结果预览:', preview + (resultText.length > 200 ? '...' : ''));
                    }

                    console.log('\n========================================');
                    console.log('💡 提示:');
                    console.log('- 使用 node test_tools_direct.cjs 测试所有工具');
                    console.log('- 使用 node test_weather_search.cjs 批量测试密钥');
                    console.log('- 使用 node test_sse_validation.cjs 测试SSE连接');

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

// 发送测试搜索请求来验证连接
const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
        name: "search",
        arguments: {
            query: "test connection",
            max_results: 1
        }
    }
};

mcpProcess.stdin.write(JSON.stringify(request) + '\n');
mcpProcess.stdin.end();