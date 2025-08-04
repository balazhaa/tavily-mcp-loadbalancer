#!/usr/bin/env node

// 测试所有Tavily工具
const { spawn } = require('child_process');

console.log('🧪 Tavily MCP 负载均衡器工具测试');
console.log('======================================');

// 测试工具列表
const tests = [
    {
        name: 'tavily_get_stats',
        args: {},
        description: 'API密钥池统计'
    },
    {
        name: 'tavily-search',
        args: {
            query: 'Node.js',
            max_results: 2
        },
        description: '网络搜索功能'
    }
];

let currentTest = 0;

function runTest(testConfig) {
    console.log(`🔧 测试工具: ${testConfig.name}`);
    console.log(`描述: ${testConfig.description}`);
    console.log('----------------------------------------');
    
    const mcpProcess = spawn('node', ['dist/index.js'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
    });

    let responseData = '';
    let hasReceivedResponse = false;

    const timeout = setTimeout(() => {
        if (!hasReceivedResponse) {
            console.log('❌ 测试超时\n');
            mcpProcess.kill();
            runNextTest();
        }
    }, 15000);

    mcpProcess.stdout.on('data', (data) => {
        responseData += data.toString();
        
        const lines = responseData.split('\n');
        for (const line of lines) {
            if (line.trim() && line.includes('"jsonrpc"')) {
                try {
                    const response = JSON.parse(line.trim());
                    if (response.result) {
                        hasReceivedResponse = true;
                        clearTimeout(timeout);
                        
                        if (response.result.isError) {
                            console.log('❌ 测试失败');
                            console.log('错误信息:', response.result.content[0].text);
                        } else {
                            console.log('✅ 测试通过');
                            const resultText = response.result.content[0].text;
                            
                            // 显示结果预览
                            if (testConfig.name === 'tavily_get_stats') {
                                try {
                                    const stats = JSON.parse(resultText);
                                    console.log(`活跃密钥: ${stats.active}/${stats.total}`);
                                } catch (e) {
                                    console.log('统计信息获取成功');
                                }
                            } else {
                                const preview = resultText.substring(0, 200);
                                console.log('结果预览:', preview + (resultText.length > 200 ? '...' : ''));
                            }
                        }
                        
                        console.log('');
                        mcpProcess.kill();
                        runNextTest();
                        return;
                    }
                } catch (e) {
                    // 继续等待
                }
            }
        }
    });

    mcpProcess.on('error', (error) => {
        console.log('❌ 启动失败:', error.message);
        runNextTest();
    });

    // 发送请求
    const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
            name: testConfig.name,
            arguments: testConfig.args
        }
    };

    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    mcpProcess.stdin.end();
}

function runNextTest() {
    if (currentTest < tests.length) {
        runTest(tests[currentTest++]);
    } else {
        console.log('======================================');
        console.log('🎉 所有测试完成！');
        console.log('');
        console.log('💡 提示:');
        console.log('- 使用 node check_stats_direct.cjs 查看详细统计');
        console.log('- 如果搜索测试失败，可能是API限制或网络问题');
        process.exit(0);
    }
}

// 开始测试
runNextTest();