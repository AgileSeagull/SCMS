#!/bin/bash

# LibraryFlow Stop Script
# This script stops both backend and frontend services

echo "📛 Stopping LibraryFlow Services..."
echo ""

# Stop backend (port 5000)
BACKEND_PID=$(lsof -ti :5000)
if [ ! -z "$BACKEND_PID" ]; then
    echo "  Stopping backend (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null
    sleep 1
    
    # Force kill if still running
    if lsof -ti :5000 > /dev/null 2>&1; then
        echo "  Force stopping backend..."
        kill -9 $BACKEND_PID 2>/dev/null
        sleep 1
    fi
    echo "  ✓ Backend stopped"
else
    echo "  No backend process found"
fi

# Stop frontend (port 3000)
FRONTEND_PIDS=$(lsof -ti :3000)
if [ ! -z "$FRONTEND_PIDS" ]; then
    echo "  Stopping frontend (PIDs: $FRONTEND_PIDS)..."
    kill $FRONTEND_PIDS 2>/dev/null
    sleep 1
    
    # Force kill if still running
    REMAINING=$(lsof -ti :3000)
    if [ ! -z "$REMAINING" ]; then
        echo "  Force stopping frontend..."
        kill -9 $REMAINING 2>/dev/null
        sleep 1
    fi
    echo "  ✓ Frontend stopped"
else
    echo "  No frontend process found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All LibraryFlow Services Stopped!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 To start services again: ./start.sh"
echo ""

