#!/usr/bin/env node

const axios = require('axios');
const { EventSource } = require('eventsource');

const BASE_URL = 'http://localhost:60002';
const SSE_URL = `${BASE_URL}/sse`;
const MESSAGE_URL = `${BASE_URL}/message`;

async function testSSEConnection() {
    console.log('🧪 测试SSE连接和消息发送...');
    
    return new Promise((resolve, reject) => {
        console.log('📡 建立SSE连接...');
        const eventSource = new EventSource(SSE_URL);
        
        let sessionId = null;
        let responseReceived = false;
        
        eventSource.onopen = function(event) {
            console.log('✅ SSE连接已建立');
        };
        
        eventSource.onmessage = function(event) {
            console.log('📨 收到SSE事件:', event.type, '数据:', event.data);
            
            try {
                // 检查是否是endpoint事件（包含sessionId）
                if (event.type === 'message' && event.data.includes('/message?sessionId=')) {
                    const match = event.data.match(/sessionId=([a-f0-9-]+)/);
                    if (match) {
                        sessionId = match[1];
                        console.log('🆔 获得会话ID:', sessionId);
                        
                        // 获得sessionId后发送测试消息
                        setTimeout(() => sendTestMessage(), 1000);
                        return;
                    }
                }
                
                // 尝试解析JSON响应
                const data = JSON.parse(event.data);
                
                // 检查是否是工具响应
                if (data.result) {
                    responseReceived = true;
                    console.log('✅ 收到工具响应');
                    
                    if (data.result.isError) {
                        console.log('❌ 工具执行错误:', data.result.content[0]?.text);
                        resolve(false);
                    } else {
                        console.log('✅ 工具执行成功');
                        const text = data.result.content[0]?.text || '';
                        console.log('响应内容长度:', text.length);
                        
                        // 检查响应是否包含问题字符
                        const hasProblematicChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text);
                        if (hasProblematicChars) {
                            console.log('⚠️  警告: 响应包含控制字符');
                        } else {
                            console.log('✅ 响应数据安全');
                        }
                        
                        // 显示响应预览
                        const preview = text.substring(0, 300);
                        console.log('响应预览:', preview + (text.length > 300 ? '...' : ''));
                        
                        resolve(true);
                    }
                    
                    eventSource.close();
                }
            } catch (error) {
                // 如果不是JSON，可能是endpoint消息，继续处理
                if (!event.data.includes('sessionId=')) {
                    console.log('解析SSE消息失败:', error.message);
                    console.log('原始消息:', event.data);
                }
            }
        };
        
        eventSource.addEventListener('endpoint', function(event) {
            console.log('📨 收到endpoint事件:', event.data);
            const match = event.data.match(/sessionId=([a-f0-9-]+)/);
            if (match) {
                sessionId = match[1];
                console.log('🆔 从endpoint事件获得会话ID:', sessionId);
                setTimeout(() => sendTestMessage(), 1000);
            }
        });
        
        eventSource.onerror = function(event) {
            console.error('❌ SSE连接错误:', event);
            if (!responseReceived) {
                eventSource.close();
                reject(new Error('SSE connection failed'));
            }
        };
        
        async function sendTestMessage() {
            if (!sessionId) {
                console.log('❌ 未获得会话ID，无法发送消息');
                return;
            }
            
            console.log('📤 发送测试消息...');
            
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
            
            try {
                const response = await axios.post(MESSAGE_URL, request, {
                    params: { sessionId },
                    timeout: 30000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log('📤 消息发送成功，状态:', response.status);
                
            } catch (error) {
                console.error('❌ 发送消息失败:', error.message);
                if (error.response) {
                    console.log('错误状态:', error.response.status);
                    console.log('错误数据:', error.response.data);
                }
                eventSource.close();
                reject(error);
            }
        }
        
        // 超时处理
        setTimeout(() => {
            if (!responseReceived) {
                console.log('⏰ 测试超时');
                eventSource.close();
                reject(new Error('Test timeout'));
            }
        }, 30000);
    });
}

async function testSearchFunction() {
    console.log('\n🔍 测试搜索功能...');
    
    return new Promise((resolve, reject) => {
        const eventSource = new EventSource(SSE_URL);
        let sessionId = null;
        let responseReceived = false;
        
        eventSource.onopen = function() {
            console.log('✅ 搜索测试SSE连接已建立');
        };
        
        eventSource.onmessage = function(event) {
            try {
                // 检查endpoint消息
                if (event.data.includes('/message?sessionId=')) {
                    const match = event.data.match(/sessionId=([a-f0-9-]+)/);
                    if (match) {
                        sessionId = match[1];
                        console.log('🆔 搜索测试会话ID:', sessionId);
                        setTimeout(sendSearchRequest, 1000);
                        return;
                    }
                }
                
                const data = JSON.parse(event.data);
                
                if (data.result) {
                    responseReceived = true;
                    console.log('✅ 收到搜索响应');
                    
                    if (data.result.isError) {
                        console.log('❌ 搜索失败:', data.result.content[0]?.text);
                        resolve(false);
                    } else {
                        const text = data.result.content[0]?.text || '';
                        console.log('✅ 搜索成功');
                        console.log('响应大小:', text.length, '字符');
                        
                        // 检查是否包含预期的搜索结果结构
                        if (text.includes('Detailed Results:') || text.includes('Answer:')) {
                            console.log('✅ 响应格式正确');
                        } else {
                            console.log('⚠️  响应格式可能异常');
                        }
                        
                        // 检查特殊字符
                        const hasProblematicChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(text);
                        if (hasProblematicChars) {
                            console.log('❌ 响应包含控制字符');
                            resolve(false);
                        } else {
                            console.log('✅ 响应字符安全');
                            resolve(true);
                        }
                    }
                    
                    eventSource.close();
                }
            } catch (error) {
                if (!event.data.includes('sessionId=')) {
                    console.error('解析搜索响应失败:', error.message);
                }
            }
        };
        
        eventSource.addEventListener('endpoint', function(event) {
            const match = event.data.match(/sessionId=([a-f0-9-]+)/);
            if (match) {
                sessionId = match[1];
                console.log('🆔 从endpoint事件获得搜索会话ID:', sessionId);
                setTimeout(sendSearchRequest, 1000);
            }
        });
        
        eventSource.onerror = function(event) {
            console.error('❌ 搜索测试SSE错误:', event);
            eventSource.close();
            reject(new Error('Search test SSE failed'));
        };
        
        async function sendSearchRequest() {
            const request = {
                jsonrpc: "2.0",
                id: 2,
                method: "tools/call",
                params: {
                    name: "tavily-search",
                    arguments: {
                        query: "Node.js tutorial",
                        max_results: 2
                    }
                }
            };
            
            try {
                await axios.post(MESSAGE_URL, request, {
                    params: { sessionId },
                    timeout: 30000,
                    headers: { 'Content-Type': 'application/json' }
                });
                console.log('📤 搜索请求已发送');
            } catch (error) {
                console.error('❌ 发送搜索请求失败:', error.message);
                eventSource.close();
                reject(error);
            }
        }
        
        setTimeout(() => {
            if (!responseReceived) {
                console.log('⏰ 搜索测试超时');
                eventSource.close();
                reject(new Error('Search test timeout'));
            }
        }, 45000);
    });
}

async function main() {
    try {
        console.log('开始基础统计测试...');
        const statsSuccess = await testSSEConnection();
        
        console.log('\n开始搜索功能测试...');
        const searchSuccess = await testSearchFunction();
        
        console.log('\n🎉 测试完成！');
        console.log('统计功能:', statsSuccess ? '✅' : '❌');
        console.log('搜索功能:', searchSuccess ? '✅' : '❌');
        
        if (statsSuccess && searchSuccess) {
            console.log('\n✅ 所有测试通过！SSE连接问题已修复。');
            console.log('🔧 修复内容:');
            console.log('  - 添加了数据验证和清理函数');
            console.log('  - 限制了响应数据大小');
            console.log('  - 移除了控制字符和特殊字符');
            console.log('  - 改进了错误处理机制');
            console.log('  - 添加了详细的日志记录');
        } else {
            console.log('\n⚠️  部分测试失败，需要进一步调试。');
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        process.exit(1);
    }
}

main();
