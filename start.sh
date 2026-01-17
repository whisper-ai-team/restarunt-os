#!/bin/sh
set -e

# Restore Google Credentials from Secret
if [ -n "$GOOGLE_CREDENTIALS_JSON" ]; then
  echo "$GOOGLE_CREDENTIALS_JSON" > /app/google-credentials.json
  echo "✅ Created google-credentials.json from secret"
fi

# Execute the main command
exec "$@"
