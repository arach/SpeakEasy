import { z } from 'zod';
import { DEFAULTS } from './constants';

export const cliSchema = z.object({
  text: z.string().optional(),
  provider: z.enum(['system', 'openai', 'elevenlabs', 'groq', 'gemini']).optional(),
  voice: z.string().optional(),
  rate: z
    .preprocess((v) => (typeof v === 'string' ? parseInt(v, 10) : v), z.number().int().min(60).max(480))
    .optional()
    .default(DEFAULTS.rate),
  volume: z
    .preprocess((v) => (typeof v === 'string' ? parseFloat(v) : v), z.number().min(0).max(1))
    .optional()
    .default(DEFAULTS.volume),
  interrupt: z.boolean().optional(),
  cache: z.boolean().optional(),
  clearCache: z.boolean().optional(),
  config: z.boolean().optional(),
  edit: z.boolean().optional(),
  diagnose: z.boolean().optional(),
  doctor: z.boolean().optional(),
  help: z.boolean().optional(),
  debug: z.boolean().optional(),
  list: z.boolean().optional(),
  find: z.string().optional(),
  stats: z.boolean().optional(),
  recent: z
    .preprocess((v) => (typeof v === 'string' ? parseInt(v, 10) : v), z.number().int().positive())
    .optional(),
  id: z.string().optional(),
  play: z.string().optional(),
  out: z.string().optional(),
  welcome: z.boolean().optional(),
});

export type CliOptions = z.infer<typeof cliSchema>;

export function parseAndValidate(raw: Record<string, unknown>): CliOptions {
  const result = cliSchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join('.') || 'argument'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid arguments:\n${message}`);
  }
  return result.data;
}


