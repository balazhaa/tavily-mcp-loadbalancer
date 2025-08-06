#!/usr/bin/env node

// 批量天气预报搜索测试脚本 - 测试所有API密钥
const { spawn } = require('child_process');
require('dotenv').config();

console.log('🌤️  Tavily 批量天气搜索测试');
console.log('======================================');

// 获取API密钥列表
const apiKeysString = process.env.TAVILY_API_KEYS || process.env.TAVILY_API_KEY;
if (!apiKeysString) {
    console.log('❌ 未找到API密钥');
    console.log('💡 请设置环境变量 TAVILY_API_KEYS 或 TAVILY_API_KEY');
    process.exit(1);
}

const apiKeys = apiKeysString.split(',').map(key => key.trim()).filter(key => key);
if (apiKeys.length === 0) {
    console.log('❌ 没有有效的API密钥');
    process.exit(1);
}

console.log(`🔑 发现 ${apiKeys.length} 个API密钥`);
console.log('======================================');

// 天气搜索查询列表 - 支持更多城市
const weatherQueries = [
    '北京天气预报',
    '上海今天天气',
    '广州天气情况',
    '深圳今日天气',
    '杭州天气预报',
    '成都天气状况',
    '武汉今天天气',
    '西安天气预报',
    '南京天气情况',
    '重庆今日天气',
    'Tokyo weather forecast',
    'New York weather today',
    'London weather forecast',
    'Paris weather today',
    'Sydney weather forecast',
    'Singapore weather today',
    'Berlin weather forecast',
    'Moscow weather today',
    'Dubai weather forecast',
    'Seoul weather today',
    'Bangkok weather forecast',
    'Los Angeles weather',
    'Chicago weather forecast',
    'Toronto weather today',
    'Mumbai weather today',
    'São Paulo weather forecast',
    'Cairo weather today',
    'Mexico City weather',
    'Buenos Aires weather',
    'Jakarta weather forecast'
];

// 测试结果统计
let testResults = {
    total: 0,
    successful: 0,
    failed: 0,
    keyResults: []
};

let currentKeyIndex = 0;

function getNextQuery() {
    // 为每个密钥分配不同的城市，循环使用查询列表
    return weatherQueries[currentKeyIndex % weatherQueries.length];
}

function testSingleKey(keyIndex, keyPreview) {
    return new Promise((resolve) => {
        const query = getNextQuery();
        
        console.log(`\n🔧 测试密钥 ${keyIndex + 1}/${apiKeys.length}`);
        console.log(`🔑 密钥: ${keyPreview}...`);
        console.log(`🔍 搜索查询: ${query}`);
        console.log(`📊 最大结果数: 1`);
        console.log('----------------------------------------');
        
        const mcpProcess = spawn('node', ['dist/index.js'], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                TAVILY_API_KEYS: apiKeys[keyIndex] // 只使用当前测试的密钥
            }
        });

        let responseData = '';
        let hasReceivedResponse = false;
        const startTime = Date.now();

        const timeout = setTimeout(() => {
            if (!hasReceivedResponse) {
                const duration = Date.now() - startTime;
                console.log(`❌ 密钥 ${keyIndex + 1} 测试超时 (${duration}ms)`);
                console.log('   可能原因: 网络超时、密钥无效或API限制');
                
                testResults.keyResults.push({
                    keyIndex: keyIndex + 1,
                    keyPreview,
                    query,
                    status: 'timeout',
                    duration,
                    error: '测试超时'
                });
                
                mcpProcess.kill();
                resolve();
            }
        }, 15000); // 15秒超时

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
                            const duration = Date.now() - startTime;
                            
                            if (response.result.isError) {
                                console.log(`❌ 密钥 ${keyIndex + 1} 搜索失败 (${duration}ms)`);
                                console.log(`   错误: ${response.result.content[0].text}`);
                                
                                testResults.failed++;
                                testResults.keyResults.push({
                                    keyIndex: keyIndex + 1,
                                    keyPreview,
                                    query,
                                    status: 'failed',
                                    duration,
                                    error: response.result.content[0].text
                                });
                            } else {
                                console.log(`✅ 密钥 ${keyIndex + 1} 搜索成功！ (${duration}ms)`);
                                
                                try {
                                    const resultText = response.result.content[0].text;
                                    const searchResult = JSON.parse(resultText);
                                    
                                    console.log(`   查询: ${searchResult.query}`);
                                    console.log(`   响应时间: ${searchResult.response_time}ms`);
                                    console.log(`   结果数量: ${searchResult.results.length}`);
                                    
                                    if (searchResult.results.length > 0) {
                                        const firstResult = searchResult.results[0];
                                        console.log(`   标题: ${firstResult.title}`);
                                        console.log(`   来源: ${firstResult.url}`);
                                        console.log(`   内容预览: ${firstResult.content.substring(0, 200)}...`);
                                        if (firstResult.score) {
                                            console.log(`   相关度评分: ${firstResult.score}`);
                                        }
                                    }
                                    
                                    if (searchResult.answer) {
                                        console.log(`   🤖 AI总结: ${searchResult.answer.substring(0, 150)}...`);
                                    }
                                    
                                    testResults.successful++;
                                    testResults.keyResults.push({
                                        keyIndex: keyIndex + 1,
                                        keyPreview,
                                        query,
                                        status: 'success',
                                        duration,
                                        responseTime: searchResult.response_time,
                                        resultCount: searchResult.results.length,
                                        title: searchResult.results[0]?.title?.substring(0, 60) + '...'
                                    });
                                    
                                } catch (parseError) {
                                    console.log(`   搜索结果获取成功`);
                                    const preview = response.result.content[0].text.substring(0, 300);
                                    console.log(`   结果预览: ${preview}...`);
                                    
                                    testResults.successful++;
                                    testResults.keyResults.push({
                                        keyIndex: keyIndex + 1,
                                        keyPreview,
                                        query,
                                        status: 'success',
                                        duration,
                                        note: '结果解析部分失败，但搜索成功'
                                    });
                                }
                            }
                            
                            mcpProcess.kill();
                            resolve();
                            return;
                        }
                    } catch (e) {
                        // 继续等待完整的JSON响应
                    }
                }
            }
        });

        mcpProcess.stderr.on('data', (data) => {
            // 静默处理服务器启动信息
        });

        mcpProcess.on('error', (error) => {
            const duration = Date.now() - startTime;
            console.log(`❌ 密钥 ${keyIndex + 1} 启动失败 (${duration}ms): ${error.message}`);
            
            testResults.failed++;
            testResults.keyResults.push({
                keyIndex: keyIndex + 1,
                keyPreview,
                query,
                status: 'error',
                duration,
                error: error.message
            });
            
            resolve();
        });

        // 发送天气搜索请求
        const request = {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {
                name: "tavily-search",
                arguments: {
                    query: query,
                    max_results: 1,
                    search_depth: "basic",
                    topic: "general"
                }
            }
        };

        mcpProcess.stdin.write(JSON.stringify(request) + '\n');
        mcpProcess.stdin.end();
    });
}

async function runAllTests() {
    testResults.total = apiKeys.length;
    
    for (let i = 0; i < apiKeys.length; i++) {
        currentKeyIndex = i;
        const keyPreview = apiKeys[i].substring(0, 10);
        await testSingleKey(i, keyPreview);
        
        // 添加短暂延迟，避免API限制
        if (i < apiKeys.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // 显示最终测试报告
    console.log('\n======================================');
    console.log('📊 批量天气搜索测试报告');
    console.log('======================================');
    console.log(`总密钥数: ${testResults.total}`);
    console.log(`成功: ${testResults.successful} ✅`);
    console.log(`失败: ${testResults.failed} ❌`);
    console.log(`成功率: ${(testResults.successful / testResults.total * 100).toFixed(1)}%`);
    
    if (testResults.successful > 0) {
        console.log('\n🎉 成功的密钥:');
        testResults.keyResults
            .filter(r => r.status === 'success')
            .forEach(result => {
                console.log(`  密钥 ${result.keyIndex}: ${result.query} - ${result.duration}ms响应`);
            });
    }
    
    if (testResults.failed > 0) {
        console.log('\n❌ 失败的密钥:');
        testResults.keyResults
            .filter(r => r.status !== 'success')
            .forEach(result => {
                console.log(`  密钥 ${result.keyIndex}: ${result.query} - ${result.status}`);
                if (result.error) {
                    console.log(`    错误: ${result.error}`);
                }
            });
    }
    
    console.log('\n💡 提示:');
    console.log('- 使用 ./manage.sh stats 查看密钥池详细状态');
    console.log('- 失败的密钥可能需要检查配额或有效性');
    console.log('- 成功率低可能表示网络问题或API限制');
    console.log('');
}

// 开始批量测试
runAllTests().catch(console.error);