import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

const CONFIG_PATH = path.resolve(process.cwd(), "config/intent_routes.yaml");
let cachedRoutes = null;
let cachedMtimeMs = 0;

const DEFAULT_ROUTES = [
  {
    id: "silence_prompt",
    matchEmpty: true,
    patterns: ["^um$", "^uh$", "^...$"],
    reply: "Sorry, I didn't catch that. Could you please repeat?",
  },
  {
    id: "repeat_that",
    patterns: [
      "^repeat that$",
      "^say that again$",
      "^can you repeat that$",
      "^what did you say$",
      "^pardon$",
    ],
    useLastAssistant: true,
    fallbackReply: "Sure. Could you say that again?",
    maxReplyChars: 400,
  },
  {
    id: "repeat_summary",
    patterns: [
      "repeat the order",
      "repeat order",
      "repeat my order",
      "repeat the order list",
      "order summary",
      "order list",
      "order recap",
      "order review",
      "read that back",
      "read back the order",
      "read my order",
      "say my order",
      "tell me my order",
      "what did i order",
      "what's in my order",
      "what is in my order",
    ],
    useLastAssistant: true,
    fallbackReply: "I can repeat the summary once we've confirmed your items.",
    maxReplyChars: 600,
  },
  {
    id: "cancel_order",
    patterns: [
      "cancel the order",
      "cancel my order",
      "stop the order",
      "forget it",
      "never mind",
      "nevermind",
    ],
    reply: "No problem. I can cancel that. Would you like to end the call?",
  },
  {
    id: "spell_that",
    patterns: [
      "spell that",
      "spell it",
      "can you spell that",
      "how do you spell that",
    ],
    reply: "Sure. Please spell it out letter by letter.",
  },
  {
    id: "wrong_number",
    patterns: ["wrong number", "sorry wrong number", "got the wrong number"],
    reply: "No problem. Sorry about that. Goodbye.",
  },
  {
    id: "presence_check",
    patterns: ["^are you there$", "^you there$", "^hello\\??$", "^hello there$", "^hey\\??$", "^hi\\??$"],
    reply: "Yes, I'm here.",
  },
  {
    id: "hold_request",
    patterns: ["^hold on$", "^one moment$", "^just a moment$", "^just a second$", "^give me a second$"],
    reply: "No problem. Take your time.",
  },
  {
    id: "pause_request",
    patterns: [
      "^pause$",
      "^pause please$",
      "^wait$",
      "^wait a second$",
      "^hold please$",
      "pause order",
      "pause the order",
    ],
    reply: "Sure, I'll pause. Let me know when you're ready to continue.",
  },
  {
    id: "continue_request",
    patterns: ["^continue$", "^resume$", "^im ready$", "^i'm ready$", "^go ahead$"],
    reply: "Great, let's continue. How can I help?",
  },
  {
    id: "thanks",
    patterns: ["^thanks$", "^thank you$", "^thankyou$", "^appreciate it$"],
    reply: "You're welcome.",
  },
];

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildRoutes() {
  if (!fs.existsSync(CONFIG_PATH)) {
    return DEFAULT_ROUTES;
  }
  try {
    const stat = fs.statSync(CONFIG_PATH);
    if (cachedRoutes && cachedMtimeMs === stat.mtimeMs) {
      return cachedRoutes;
    }
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    const parsed = yaml.parse(raw);
    if (!parsed || !Array.isArray(parsed.routes)) {
      cachedRoutes = DEFAULT_ROUTES;
      cachedMtimeMs = stat.mtimeMs;
      return DEFAULT_ROUTES;
    }
    cachedRoutes = parsed.routes;
    cachedMtimeMs = stat.mtimeMs;
    return cachedRoutes;
  } catch (err) {
    console.warn("Failed to load intent routes config; using defaults.");
    return DEFAULT_ROUTES;
  }
}

function coercePatterns(patterns) {
  if (!patterns) return [];
  const list = Array.isArray(patterns) ? patterns : [patterns];
  return list
    .map((pattern) => {
      try {
        return new RegExp(pattern, "i");
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function truncateText(text, maxChars) {
  if (!maxChars || maxChars <= 0) return text;
  if (!text || text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}...`;
}

function getLastAssistantMessage(chatCtx) {
  if (!chatCtx?.items) return null;
  for (let i = chatCtx.items.length - 1; i >= 0; i -= 1) {
    const item = chatCtx.items[i];
    if (item?.role === "assistant") {
      const text = (item.content || [])
        .map((content) => (typeof content === "string" ? content : ""))
        .join(" ")
        .trim();
      if (text) return text;
    }
  }
  return null;
}

export function getDeterministicReply(text, { chatCtx } = {}) {
  const routes = buildRoutes();
  const normalized = normalize(text);
  if (!normalized) {
    const emptyRoute = routes.find((route) => route.matchEmpty);
    if (emptyRoute?.reply) {
      return { ...emptyRoute, normalized, reply: emptyRoute.reply };
    }
    return null;
  }

  for (const route of routes) {
    const patterns = coercePatterns(route.patterns);
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        if (route.useLastAssistant) {
          const last = getLastAssistantMessage(chatCtx);
          if (last) {
            const maxChars = route.maxReplyChars || 400;
            return { ...route, normalized, reply: truncateText(last, maxChars) };
          }
          if (route.fallbackReply) {
            return { ...route, normalized, reply: route.fallbackReply };
          }
        }
        return { ...route, normalized, reply: route.reply };
      }
    }
  }

  return null;
}
