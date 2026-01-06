# How to Enable Indian Voice (Google Cloud TTS)

## The Issue

Google Cloud TTS requires a **service account JSON file** for authentication, not just an API key.

## Quick Setup (5 minutes)

### Step 1: Create Service Account

1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click "**Create Service Account**"
3. Name: `restaurant-tts`
4. Click "**Create and Continue**"
5. Grant role: **Cloud Text-to-Speech User**
6. Click "**Done**"

### Step 2: Download JSON Key

1. Click on the service account you just created
2. Go to "**Keys**" tab
3. Click "**Add Key**" → "**Create new key**"
4. Choose "**JSON**"
5. Click "**Create**" - a file will download

### Step 3: Save the File

Move the downloaded JSON file to your project:
```bash
mv ~/Downloads/restaurant-os-*.json /Users/venky/Documents/2025-projects/restaurant-os-backend/google-credentials.json
```

### Step 4: Update .env

Add this line to your `.env` file:
```bash
GOOGLE_APPLICATION_CREDENTIALS=/Users/venky/Documents/2025-projects/restaurant-os-backend/google-credentials.json
```

### Step 5: Restart Agent

```bash
npm run agent:dev
```

**That's it!** Your agent will now speak with an authentic Indian English accent! 🇮🇳

---

## Alternative: Use API Key (Simpler but might not work)

If the service account method doesn't work, you can try using just the API key:

1. Make sure your `.env` has:
   ```bash
   GOOGLE_CLOUD_API_KEY=your-api-key-here
   ```

2. The agent will try to use this automatically.

---

## Verify It's Working

When you restart the agent and make a call, you should hear:
- ✅ Indian English accent
- ✅ Perfect pronunciation of "Hyderabadi Biryani", "Masala Dosa", etc.
- ✅ Natural, conversational tone

---

## Troubleshooting

### Error: "Could not load credentials"

**Solution**: Make sure the path in `GOOGLE_APPLICATION_CREDENTIALS` is absolute and correct.

### Error: "Permission denied"

**Solution**: Make sure the Text-to-Speech API is enabled:
https://console.cloud.google.com/apis/library/texttospeech.googleapis.com

### Still not working?

Let me know and I'll help debug! We can also fall back to OpenAI TTS which works great (just without the Indian accent).
