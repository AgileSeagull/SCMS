#!/bin/bash

# LibraryFlow Start Script
# This script starts both backend and frontend services

echo "🚀 Starting LibraryFlow Services..."
echo ""

# Check if services are already running
BACKEND_PID=$(lsof -ti :5000)
FRONTEND_PID=$(lsof -ti :3000)

if [ ! -z "$BACKEND_PID" ]; then
    echo "⚠️  Backend is already running (PID: $BACKEND_PID)"
    if [ "$SKIP_PROMPTS" = "true" ]; then
        echo "   Stopping existing backend (auto-restart)..."
        kill $BACKEND_PID 2>/dev/null
        sleep 1
    else
        read -p "   Do you want to restart it? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "   Stopping existing backend..."
            kill $BACKEND_PID 2>/dev/null
            sleep 1
        else
            echo "   Skipping backend start"
            SKIP_BACKEND=true
        fi
    fi
fi

if [ ! -z "$FRONTEND_PID" ]; then
    echo "⚠️  Frontend is already running (PID: $FRONTEND_PID)"
    if [ "$SKIP_PROMPTS" = "true" ]; then
        echo "   Stopping existing frontend (auto-restart)..."
        kill $FRONTEND_PID 2>/dev/null
        sleep 1
    else
        read -p "   Do you want to restart it? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "   Stopping existing frontend..."
            kill $FRONTEND_PID 2>/dev/null
            sleep 1
        else
            echo "   Skipping frontend start"
            SKIP_FRONTEND=true
        fi
    fi
fi

echo ""

# Start backend
if [ -z "$SKIP_BACKEND" ]; then
    echo "🔧 Starting backend..."
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    cd "$SCRIPT_DIR/backend"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "  Installing dependencies..."
        npm install
    fi
    
    npm run dev > /dev/null 2>&1 &
    BACKEND_PID=$!
    echo "  Backend started (PID: $BACKEND_PID)"
    
    # Wait for backend to be ready
    echo "  Waiting for backend to start..."
    for i in {1..10}; do
        if curl -s http://localhost:5000/api/health > /dev/null 2>&1; then
            echo "  ✓ Backend ready!"
            break
        fi
        sleep 1
    done
else
    BACKEND_PID=$(lsof -ti :5000)
fi

# Start frontend
if [ -z "$SKIP_FRONTEND" ]; then
    echo ""
    echo "🌐 Starting frontend..."
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    cd "$SCRIPT_DIR/frontend"
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "  Installing dependencies..."
        npm install
    fi
    
    npm start > /dev/null 2>&1 &
    FRONTEND_PID=$!
    echo "  Frontend started (PID: $FRONTEND_PID)"
    
    # Wait for frontend to be ready
    echo "  Waiting for frontend to start..."
    for i in {1..15}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo "  ✓ Frontend ready!"
            break
        fi
        sleep 1
    done
else
    FRONTEND_PID=$(lsof -ti :3000)
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ LibraryFlow Services Started!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Service Status:"
echo "  Backend:  http://localhost:5000 (PID: $BACKEND_PID)"
echo "  Frontend: http://localhost:3000 (PID: $FRONTEND_PID)"
echo "  Prisma:   http://localhost:5555 (if running)"
echo ""
echo "📖 Next Steps:"
echo "  1. Open http://localhost:3000 in your browser"
echo "  2. Register/Login to test the application"
echo ""
echo "💡 To stop services: ./stop.sh"
echo ""

