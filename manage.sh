#!/bin/bash

# Tavily MCP 负载均衡器管理脚本

case "$1" in
    "stats"|"status")
        echo "📊 获取API密钥池状态..."
        node check_stats_direct.cjs
        ;;
    "test")
        echo "🧪 测试所有工具..."
        node test_tools_direct.cjs
        ;;
    "help"|"--help"|"-h"|"")
        echo "Tavily MCP 负载均衡器管理工具"
        echo ""
        echo "使用方法:"
        echo "  ./manage.sh stats    - 查看API密钥池状态"
        echo "  ./manage.sh test     - 测试所有工具"
        echo "  ./manage.sh help     - 显示此帮助信息"
        echo ""
        echo "直接使用:"
        echo "  node check_stats_direct.cjs    - 查看详细统计"  
        echo "  node test_tools_direct.cjs     - 运行工具测试"
        echo ""
        echo "启动服务器:"
        echo "  npm run build-and-start        - 构建并启动服务器"
        echo "  npm run start-gateway          - 启动服务器（已构建）"
        ;;
    *)
        echo "❌ 未知命令: $1"
        echo "使用 './manage.sh help' 查看帮助"
        exit 1
        ;;
esac