import publishedTokens from "@/design-system/tokens.json";

export type HeroGlassConfig = {
  mode: "css" | "shader";
  blur: number;
  saturation: number;
  tint: number;
  shine: number;
  refraction: number;
};

export const INITIAL_HERO_GLASS_DRAFT: HeroGlassConfig = {
  mode: "shader",
  blur: 7,
  saturation: 130,
  tint: 0,
  shine: 26,
  refraction: 18,
};

const ranges = {
  blur: [0, 40],
  saturation: [80, 170],
  tint: [0, 30],
  shine: [0, 100],
  refraction: [0, 20],
} as const;

export function parseHeroGlassConfig(value: unknown): HeroGlassConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.mode !== "css" && raw.mode !== "shader") return null;
  const config = { mode: raw.mode } as HeroGlassConfig;
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
    const number = raw[key];
    const [min, max] = ranges[key];
    if (typeof number !== "number" || !Number.isInteger(number) || number < min || number > max) return null;
    config[key] = number;
  }
  return config;
}

export const PUBLISHED_HERO_GLASS =
  parseHeroGlassConfig(publishedTokens["hero.glass"]) ?? {
    mode: "css",
    blur: 15,
    saturation: 120,
    tint: 5,
    shine: 0,
    refraction: 0,
  };

export const HERO_GLASS_COMPONENT_KEY = "hero.glass";
