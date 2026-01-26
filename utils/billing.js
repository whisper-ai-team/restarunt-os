import { DateTime } from "luxon";

const DEFAULT_MAX_CALL_SECONDS = parseInt(process.env.AI_MAX_CALL_SECONDS || "1800", 10);

const PLAN_DEFAULTS = {
  free: { monthlyMinutes: 100, maxCallSeconds: DEFAULT_MAX_CALL_SECONDS },
  basic: { monthlyMinutes: 500, maxCallSeconds: DEFAULT_MAX_CALL_SECONDS },
  premium: { monthlyMinutes: -1, maxCallSeconds: DEFAULT_MAX_CALL_SECONDS },
  pro: { monthlyMinutes: -1, maxCallSeconds: DEFAULT_MAX_CALL_SECONDS },
};

function getPlanOverride(plan, key) {
  const envKey = `AI_${key}_${plan.toUpperCase()}`;
  const raw = process.env[envKey];
  if (raw === undefined) return null;
  const val = parseInt(raw, 10);
  return Number.isNaN(val) ? null : val;
}

export function getPlanLimits(plan) {
  const normalized = (plan || "free").toLowerCase();
  const base = PLAN_DEFAULTS[normalized] || PLAN_DEFAULTS.free;
  const monthlyMinutes = getPlanOverride(normalized, "MONTHLY_MINUTES") ?? base.monthlyMinutes;
  const maxCallSeconds = getPlanOverride(normalized, "MAX_CALL_SECONDS") ?? base.maxCallSeconds;
  return { planKey: normalized, monthlyMinutes, maxCallSeconds };
}

export function getBillingCycleStart({ nextBillingDate, billingCycle, timezone }) {
  const tz = timezone || "America/New_York";
  const now = DateTime.now().setZone(tz);
  if (nextBillingDate) {
    const next = DateTime.fromJSDate(nextBillingDate).setZone(tz);
    if (next.isValid) {
      const delta = (billingCycle || "monthly") === "yearly" ? { years: 1 } : { months: 1 };
      const start = next.minus(delta);
      if (start.isValid) return start;
    }
  }
  return now.startOf("month");
}

export async function getUsageStatus(prisma, restaurantConfig, planLimits) {
  const { monthlyMinutes } = planLimits;
  if (!restaurantConfig?.id || monthlyMinutes < 0) {
    return { usageExceeded: false, usedMinutes: 0, cycleStart: null };
  }

  const cycleStart = getBillingCycleStart(restaurantConfig);
  const usageAgg = await prisma.call.aggregate({
    where: {
      restaurantId: restaurantConfig.id,
      createdAt: { gte: cycleStart.toJSDate() },
    },
    _sum: { duration: true },
  });
  const usedMinutes = Math.round((usageAgg._sum.duration || 0) / 60);
  return { usageExceeded: usedMinutes >= monthlyMinutes, usedMinutes, cycleStart };
}
