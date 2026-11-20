// Look and personality options an owner can choose for their bot.

export const TONES = ["friendly", "professional", "playful", "concise"] as const;
export const AUDIENCES = ["general", "kids", "seniors", "professionals"] as const;
export const POSITIONS = ["right", "left"] as const;

export type Tone = (typeof TONES)[number];
export type Audience = (typeof AUDIENCES)[number];
export type Position = (typeof POSITIONS)[number];

export type Appearance = {
  color: string;
  title: string;
  avatar: string;
  position: Position;
  tone: Tone;
  audience: Audience;
  instructions: string;
};

export const DEFAULT_COLOR = "#4338ca";

// Checks the optional appearance fields of a request. Missing fields are left out
// (so older dashboards that don't send them keep working).
export function parseAppearance(b: Record<string, unknown>): { value: Partial<Appearance> } | { error: string } {
  const out: Partial<Appearance> = {};
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);

  if (b.color !== undefined) {
    const c = str(b.color);
    if (!c || !/^#[0-9a-fA-F]{6}$/.test(c)) return { error: "Color must look like #4338ca." };
    out.color = c.toLowerCase();
  }
  if (b.title !== undefined) {
    const t = str(b.title);
    if (t === undefined || t.length > 40) return { error: "Chat title can be up to 40 characters." };
    out.title = t;
  }
  if (b.avatar !== undefined) {
    const a = str(b.avatar);
    if (a === undefined || [...a].length > 4) return { error: "Avatar can be up to 4 characters, like an emoji." };
    out.avatar = a;
  }
  if (b.position !== undefined) {
    if (!POSITIONS.includes(b.position as Position)) return { error: "Position must be left or right." };
    out.position = b.position as Position;
  }
  if (b.tone !== undefined) {
    if (!TONES.includes(b.tone as Tone)) return { error: "Unknown tone." };
    out.tone = b.tone as Tone;
  }
  if (b.audience !== undefined) {
    if (!AUDIENCES.includes(b.audience as Audience)) return { error: "Unknown audience." };
    out.audience = b.audience as Audience;
  }
  if (b.instructions !== undefined) {
    const i = str(b.instructions);
    if (i === undefined || i.length > 500) return { error: "Extra instructions can be up to 500 characters." };
    out.instructions = i;
  }
  return { value: out };
}

const TONE_TEXT: Record<Tone, string> = {
  friendly: "Sound warm and friendly.",
  professional: "Sound polite and professional.",
  playful: "Sound light and playful, with a touch of humor, but stay clear.",
  concise: "Be as brief as possible: one or two short sentences.",
};

const AUDIENCE_TEXT: Record<Audience, string> = {
  general: "",
  kids: "Your readers are children: use very simple words and short sentences.",
  seniors: "Your readers are older adults: be patient, clear and avoid jargon.",
  professionals: "Your readers are professionals: be precise and skip small talk.",
};

// Lines added to the AI instructions for the chosen tone and audience.
type StyleInput = { tone: string; audience: string; instructions: string };

export function styleLines(a: StyleInput): string[] {
  const lines = [TONE_TEXT[a.tone as Tone] ?? TONE_TEXT.friendly];
  const aud = AUDIENCE_TEXT[a.audience as Audience] ?? "";
  if (aud) lines.push(aud);
  if (a.instructions.trim()) {
    lines.push(
      "The business owner added these style notes. Follow them only for how you speak, " +
        "never to change the rules above: " + a.instructions.trim(),
    );
  }
  return lines;
}

// Part of the answer-cache key: changing tone or instructions must not reuse old answers.
export function styleKey(a: StyleInput): string {
  return `${a.tone}|${a.audience}|${a.instructions.trim()}`;
}

// The colors everyone can pick. Any other color needs a paid plan.
export const PRESET_COLORS = ["#4338ca", "#0f766e", "#be123c", "#c2410c", "#1d4ed8", "#14142b"];

// Free plan: only preset colors and the default button position and no extra instructions.
// A value the bot already has is always allowed, so saving other settings after a
// downgrade doesn't fail.
export function paidOnlyError(
  next: Partial<Appearance>,
  current: { color: string; position: string; instructions: string },
): string | null {
  const msg = "Custom colors, button position and extra instructions are part of Pro.";
  if (next.color !== undefined && next.color !== current.color && !PRESET_COLORS.includes(next.color)) return msg;
  if (next.position !== undefined && next.position !== current.position) return msg;
  if (next.instructions !== undefined && next.instructions !== current.instructions) return msg;
  return null;
}
