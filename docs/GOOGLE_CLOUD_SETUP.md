# Google Cloud TTS Setup Guide

## Quick Setup (2 Options)

### Option 1: API Key (Easiest) ⭐

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Enable Text-to-Speech API**:
   - Search for "Text-to-Speech API"
   - Click "Enable"
3. **Create API Key**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the API key

4. **Add to .env file**:
   ```bash
   GOOGLE_CLOUD_API_KEY=your-api-key-here
   ```

### Option 2: Service Account (More Secure)

1. **Create Service Account**:
   - Go to "IAM & Admin" → "Service Accounts"
   - Click "Create Service Account"
   - Name it "restaurant-tts"
   - Grant role: "Cloud Text-to-Speech User"

2. **Download JSON Key**:
   - Click on the service account
   - Go to "Keys" tab
   - "Add Key" → "Create new key" → "JSON"
   - Save the file to your project

3. **Add to .env file**:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
   ```

## Test the Setup

Run the agent:
```bash
npm run agent:dev
```

The agent will now speak with an authentic Indian English accent!

## Available Indian Voices

You can change the voice in `agent.js` (line 449):

```javascript
voice: "en-IN-Neural2-B", // Current: Male, professional
```

**Try these alternatives**:
- `en-IN-Neural2-A` - Female, warm and friendly (great for hospitality!)
- `en-IN-Neural2-C` - Male, conversational
- `en-IN-Neural2-D` - Female, clear and articulate

## Cost Comparison

| Provider | Cost per 1M chars | 2-min call | 1,000 calls/month |
|----------|-------------------|------------|-------------------|
| **Google Cloud TTS** | $4 | $0.006 | **$6** ✅ |
| OpenAI TTS | $15 | $0.0225 | $22.50 |
| ElevenLabs | $300 | $0.45 | $450 |

**Savings**: 99% vs ElevenLabs, 73% vs OpenAI!

## Troubleshooting

### Error: "GOOGLE_APPLICATION_CREDENTIALS not set"

**Solution**: Add one of these to your `.env` file:
```bash
# Option 1: API Key
GOOGLE_CLOUD_API_KEY=your-key

# Option 2: Service Account
GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
```

### Error: "Text-to-Speech API has not been used"

**Solution**: Enable the API in Google Cloud Console:
1. Go to https://console.cloud.google.com/apis/library/texttospeech.googleapis.com
2. Click "Enable"

### Voice sounds too fast/slow

**Adjust in agent.js**:
```javascript
speakingRate: 0.9, // Slower (0.75-1.25)
```

### Voice sounds too high/low

**Adjust in agent.js**:
```javascript
pitch: -5.0, // Lower pitch (-20.0 to 20.0)
```

## Next Steps

1. Set up Google Cloud credentials (see above)
2. Test the agent with a call
3. Try different voices to find the best fit
4. Adjust speaking rate and pitch if needed

Your restaurant AI now speaks with an authentic Indian accent! 🇮🇳
