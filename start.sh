#!/bin/sh
set -e

# Restore Google Credentials from Secret
if [ -n "$GOOGLE_CREDENTIALS_JSON" ]; then
  echo "$GOOGLE_CREDENTIALS_JSON" > /app/google-credentials.json
  echo "✅ Created google-credentials.json from secret (size: $(wc -c < /app/google-credentials.json) bytes)"
else
  echo "⚠️ GOOGLE_CREDENTIALS_JSON secret is MISSING!"
fi

# Execute the main command
exec "$@"
