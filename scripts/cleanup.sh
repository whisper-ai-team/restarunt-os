#!/bin/bash

echo "🚿 Starting deep cleanup of Node/Agent processes..."

# Kill all node processes related to server or agent
echo "🔪 Killing node processes..."
pkill -f "node server.js"
pkill -f "node agent.js"
pkill -f "npm run agent"

# Kill LiveKit orphaned workers specifically if they linger
echo "🔪 Killing orphaned job processes..."
pkill -f "job_proc_lazy_main"

# Clean up temp files
echo "🧹 Cleaning up temp job files..."
rm -f .id_token
rm -f active_calls_context.json # Optional: reset room context if needed

echo "✅ Cleanup complete. You can now start the services safely."
echo "   Run: PORT=3001 node server.js"
echo "   Followed by: npm run agent:dev"
