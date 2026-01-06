# Indian Voice Options for Restaurant AI

## Current Status
✅ **OpenAI TTS** is working with "nova" voice (American accent)

## Options for Indian Accent Voices

### Option 1: Google Cloud TTS (Recommended) ⭐

**Native Indian English voices** with authentic accent:

**Available Voices**:
- `en-IN-Neural2-A` - Female, warm and friendly
- `en-IN-Neural2-B` - Male, professional
- `en-IN-Neural2-C` - Male, conversational
- `en-IN-Neural2-D` - Female, clear and articulate
- `en-IN-Wavenet-A` - Female (older model)
- `en-IN-Wavenet-B` - Male (older model)
- `en-IN-Wavenet-C` - Male (older model)
- `en-IN-Wavenet-D` - Female (older model)

**Cost**: $4/1M characters (even cheaper than OpenAI!)

**Setup Required**:
1. Upgrade LiveKit agents to v1.0.31+
2. Install `@livekit/agents-plugin-google`
3. Set up Google Cloud credentials

**Code Change**:
```javascript
import * as google from "@livekit/agents-plugin-google";

tts: new google.TTS({
  voice: "en-IN-Neural2-B", // Male Indian English
  languageCode: "en-IN",
  speakingRate: 1.0,
  pitch: 0.0,
}),
```

---

### Option 2: ElevenLabs Indian Voices (Premium)

ElevenLabs has high-quality Indian accent voices, but expensive:

**Available Voices**:
- Search their voice library for Indian English speakers
- Can clone custom Indian voices

**Cost**: $300/1M characters (your original setup)

**Pros**: Best quality, most natural
**Cons**: Very expensive

---

### Option 3: OpenAI TTS with Prompt Engineering (Current)

While OpenAI doesn't have native Indian voices, you can:

1. **Add pronunciation hints** in the text:
   ```javascript
   // Before TTS, modify text to guide pronunciation
   text = text.replace("Biryani", "Bir-ya-nee");
   ```

2. **Use SSML-like formatting** (limited support)

**Pros**: Already working, no changes needed
**Cons**: American accent, not authentic Indian

---

### Option 4: Azure TTS (Alternative)

Microsoft Azure has Indian voices:

**Available Voices**:
- `en-IN-NeerjaNeural` - Female
- `en-IN-PrabhatNeural` - Male

**Cost**: $15/1M characters (same as OpenAI)

**Setup**: Requires Azure account and `@livekit/agents-plugin-azure`

---

## Recommendation

**Try Google Cloud TTS first** - it has the best Indian accent at the lowest cost ($4/1M vs $15/1M for OpenAI).

If the version upgrade works, you'll get:
- ✅ Authentic Indian English accent
- ✅ 73% cheaper than OpenAI ($4 vs $15)
- ✅ 99% cheaper than ElevenLabs ($4 vs $300)
- ✅ Perfect pronunciation of Indian food terms

Would you like me to:
1. Try upgrading to Google Cloud TTS with Indian voices?
2. Stick with OpenAI and add pronunciation improvements?
3. Explore Azure TTS as a middle ground?
