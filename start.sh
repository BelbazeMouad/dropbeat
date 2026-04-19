#!/bin/sh

# Start bgutil PO token server
echo "Starting PO Token server..."
cd /opt/bgutil-ytdlp-pot-provider/server
node build/main.js &
BGPID=$!

# Wait and verify
sleep 5
if kill -0 $BGPID 2>/dev/null; then
  echo "PO Token server running on port 4416"
else
  echo "WARNING: PO Token server failed to start, trying src/main.js..."
  node src/main.js &
  sleep 3
fi

# Start the app
cd /app
echo "Starting DROPBEAT..."
exec node server.js
