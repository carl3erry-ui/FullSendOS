import { z } from "zod";

const XaiContentBlockSchema = z.object({
  type: z.string().optional(),
  text: z.string().nullable().optional(),
});

const XaiOutputItemSchema = z.object({
  content: z.array(XaiContentBlockSchema).optional(),
});

export const XaiUsageSchema = z.object({
  input_tokens: z.number().nullable().optional(),
  output_tokens: z.number().nullable().optional(),
  total_tokens: z.number().nullable().optional(),
});

export const XaiErrorSchema = z.object({
  message: z.string().optional(),
  type: z.string().optional(),
  code: z.string().optional(),
});

export const XaiResponsesApiSchema = z.object({
  id: z.string().optional(),
  model: z.string().optional(),
  output_text: z.string().optional(),
  usage: XaiUsageSchema.optional(),
  output: z.array(XaiOutputItemSchema).optional(),
  error: XaiErrorSchema.nullable().optional(),
});

export type XaiResponsesApiInput = z.infer<typeof XaiResponsesApiSchema>;
