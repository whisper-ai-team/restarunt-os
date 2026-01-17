import { NextResponse } from "next/server";

// Professional voice catalog with rich metadata
const PROFESSIONAL_VOICES = [
    {
        name: "Nova",
        id: "nova",
        tags: ["female", "energetic", "hospitality"],
        description: "High-energy, enthusiastic voice perfect for hospitality",
        gender: "female",
        tone: "energetic",
        bestFor: "Fast-paced restaurants, cafes, high-energy brands"
    },
    {
        name: "Shimmer",
        id: "shimmer",
        tags: ["female", "soft", "clear"],
        description: "Professional, soft-spoken voice with clarity",
        gender: "female",
        tone: "professional",
        bestFor: "Fine dining, professional services, calm environments"
    },
    {
        name: "Alloy",
        id: "alloy",
        tags: ["neutral", "balanced", "professional"],
        description: "Balanced, neutral voice for professional settings",
        gender: "neutral",
        tone: "balanced",
        bestFor: "All-purpose, corporate, professional environments"
    },
    {
        name: "Echo",
        id: "echo",
        tags: ["male", "warm", "deep"],
        description: "Warm, deep male voice that builds trust",
        gender: "male",
        tone: "warm",
        bestFor: "Luxury brands, upscale establishments, trustworthiness"
    },
    {
        name: "Onyx",
        id: "onyx",
        tags: ["male", "authoritative", "confidence"],
        description: "Authoritative, confident voice with presence",
        gender: "male",
        tone: "authoritative",
        bestFor: "Premium services, executive settings, strong presence"
    },
    {
        name: "Fable",
        id: "fable",
        tags: ["neutral", "dynamic", "storyteller"],
        description: "Dynamic storyteller voice with personality",
        gender: "neutral",
        tone: "dynamic",
        bestFor: "Creative brands, unique experiences, storytelling"
    }
];

export async function GET() {
    return NextResponse.json({
        voices: PROFESSIONAL_VOICES,
        count: PROFESSIONAL_VOICES.length
    });
}
