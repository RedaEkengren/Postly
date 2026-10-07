import { z } from 'zod';
import {
  SUPPRESSION_REASONS,
  API_KEY_SCOPES,
  BATCH_MAX_SIZE,
} from './constants.js';

const sendEmailFields = z.object({
  from: z.string().min(1),
  to: z.array(z.email()).min(1),
  cc: z.array(z.email()).optional(),
  bcc: z.array(z.email()).optional(),
  reply_to: z.email().optional(),
  subject: z.string().min(1).max(998).optional(),
  html: z.string().optional(),
  text: z.string().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        content_type: z.string(),
        content_base64: z.string(),
      }),
    )
    .optional(),
  headers: z.record(z.string(), z.string()).optional(),
  tags: z.record(z.string(), z.string()).optional(),
  scheduled_at: z.iso.datetime().optional(),
  template: z
    .object({
      slug: z.string(),
      version: z.number().int().positive().nullable().optional(),
      variables: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

// A template supplies its own subject and body; without one, both are required.
function requireContent(
  input: { subject?: string; html?: string; text?: string; template?: unknown },
  ctx: z.RefinementCtx,
) {
  if (input.template) return;
  if (!input.subject) {
    ctx.addIssue({ code: 'custom', path: ['subject'], message: 'Required unless template is given' });
  }
  if (!input.html && !input.text) {
    ctx.addIssue({ code: 'custom', path: ['html'], message: 'One of html, text or template is required' });
  }
}

export const sendEmailSchema = sendEmailFields.superRefine(requireContent);

export const batchEmailSchema = z.object({
  messages: z
    .array(sendEmailFields.extend({ idempotency_key: z.string().optional() }).superRefine(requireContent))
    .min(1)
    .max(BATCH_MAX_SIZE),
});

// One DNS label: the envelope-sender subdomain whose MX points at Postly.
const DNS_LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const DOMAIN_NAME = /^(?=.{1,253}$)((?!-)[a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,63}$/;

export const createDomainSchema = z.object({
  domain: z.string().toLowerCase().regex(DOMAIN_NAME, 'Must be a domain name such as example.com'),
  return_path: z.string().toLowerCase().regex(DNS_LABEL, 'Must be a single DNS label').default('bounces'),
});

export const createSuppressionSchema = z.object({
  address: z.email(),
  reason: z.enum(SUPPRESSION_REASONS),
  note: z.string().optional(),
});

export const createTemplateSchema = z.object({
  slug: z.string().min(1).max(128),
  format: z.enum(['html', 'mjml', 'react']),
  source: z.string().min(1),
  subject: z.string().min(1),
  vars_schema: z.record(z.string(), z.unknown()).optional(),
});

export const createWebhookSchema = z.object({
  url: z.url({ protocol: /^https?$/ }),
  events: z.array(z.enum([
    'email.queued',
    'email.sent',
    'email.delivered',
    'email.bounced',
    'email.complained',
    'email.opened',
    'email.clicked',
    'email.failed',
    'domain.verified',
    'domain.verification_failed',
  ])).min(1),
  description: z.string().optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
});

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;
export type BatchEmailInput = z.infer<typeof batchEmailSchema>;
export type CreateDomainInput = z.infer<typeof createDomainSchema>;
export type CreateSuppressionInput = z.infer<typeof createSuppressionSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
