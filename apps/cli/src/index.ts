#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { Command } from 'commander';
import { Postly } from '@postly/node';

function getClient(): Postly {
  const apiKey = process.env.POSTLY_API_KEY;
  if (!apiKey) {
    console.error('Error: POSTLY_API_KEY environment variable is required');
    process.exit(1);
  }
  return new Postly({
    apiKey,
    baseUrl: process.env.POSTLY_API_URL ?? 'https://api.postly.eu',
  });
}

const program = new Command();

program
  .name('postly')
  .description('Postly CLI — transactional email API')
  .version('0.0.1');

program
  .command('send')
  .description('Send a test email')
  .requiredOption('--from <address>', 'Sender address')
  .requiredOption('--to <address>', 'Recipient address')
  .requiredOption('--subject <subject>', 'Email subject')
  .option('--html <html>', 'HTML body')
  .option('--text <text>', 'Plain text body')
  .action(async (opts) => {
    const client = getClient();
    const result = await client.emails.send({
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    console.log(`Queued: ${result.id} (status: ${result.status})`);
  });

function printNextPage(cursor: string | null) {
  if (cursor) console.log(`\nMore results: --cursor ${cursor}`);
}

program
  .command('emails')
  .description('List recent emails')
  .option('--limit <n>', 'Number of results', '10')
  .option('--cursor <cursor>', 'Continue from a previous page')
  .action(async (opts) => {
    const client = getClient();
    const result = await client.emails.list({ limit: Number(opts.limit), cursor: opts.cursor });
    if (result.data.length === 0) {
      console.log('No emails found.');
      return;
    }
    for (const msg of result.data) {
      console.log(`${msg.id}  ${msg.status.padEnd(10)}  ${msg.to.join(',')}  ${msg.subject}`);
    }
    printNextPage(result.next_cursor);
  });

program
  .command('email <id>')
  .description('Get email details')
  .action(async (id) => {
    const client = getClient();
    const msg = await client.emails.get(id);
    console.log(JSON.stringify(msg, null, 2));
  });

program
  .command('domains')
  .description('List domains')
  .action(async () => {
    const client = getClient();
    const result = await client.domains.list();
    if (result.data.length === 0) {
      console.log('No domains found.');
      return;
    }
    for (const d of result.data) {
      const status = d.dkim_status === 'verified' ? 'verified' : 'pending';
      console.log(`${d.domain.padEnd(30)}  ${status.padEnd(10)}  ${d.return_path_domain}`);
    }
  });

program
  .command('domain:add <domain>')
  .description('Add a domain')
  .option('--return-path <label>', 'Envelope-sender subdomain', 'bounces')
  .action(async (domain, opts) => {
    const client = getClient();
    const result = await client.domains.create({ domain, return_path: opts.returnPath });
    console.log(`Domain ${result.domain} added (${result.dkim_status})`);
    console.log('\nAdd these DNS records:');
    for (const r of result.dns_records) {
      const note = r.required ? '' : '  (recommended)';
      console.log(`  ${r.type.padEnd(4)}  ${r.name}\n        ${r.value}${note}`);
    }
  });

program
  .command('domain:verify <domain>')
  .description('Verify a domain')
  .action(async (domain) => {
    const client = getClient();
    const result = await client.domains.verify(domain);
    console.log(`Domain ${result.domain}: DKIM=${result.dkim_status}, SPF=${result.spf_status}, DMARC=${result.dmarc_status}`);
  });

program
  .command('suppressions')
  .description('List suppressions')
  .option('--reason <reason>', 'Filter by reason')
  .option('--limit <n>', 'Number of results', '25')
  .option('--cursor <cursor>', 'Continue from a previous page')
  .action(async (opts) => {
    const client = getClient();
    const result = await client.suppressions.list({
      reason: opts.reason,
      limit: Number(opts.limit),
      cursor: opts.cursor,
    });
    if (result.data.length === 0) {
      console.log('No suppressions found.');
      return;
    }
    for (const s of result.data) {
      console.log(`${s.address.padEnd(40)}  ${s.reason.padEnd(12)}  ${s.created_at}`);
    }
    printNextPage(result.next_cursor);
  });

program
  .command('api-keys')
  .description('List API keys')
  .action(async () => {
    const client = getClient();
    const result = await client.apiKeys.list();
    if (result.data.length === 0) {
      console.log('No API keys found.');
      return;
    }
    for (const k of result.data) {
      console.log(`${k.id}  ${k.name.padEnd(20)}  ${k.key_prefix}...  ${k.scopes.length} scopes`);
    }
  });

program
  .command('account')
  .description('Show account info')
  .action(async () => {
    const client = getClient();
    const result = await client.account.get();
    console.log(`Organization: ${result.name}`);
    console.log(`Plan: ${result.plan}`);
    console.log(`Status: ${result.status}`);
    console.log(`Credit balance: ${result.credit_balance}`);
  });

program
  .command('batch <file>')
  .description('Send the messages in a JSON file (an array, up to 500)')
  .action(async (file) => {
    const client = getClient();
    const messages = JSON.parse(await readFile(file, 'utf8'));
    const { results } = await client.emails.sendBatch(messages);
    for (const r of results) {
      console.log(r.status === 'queued' ? `${r.index}  queued    ${r.id}` : `${r.index}  rejected  ${r.error.title}: ${r.error.detail}`);
    }
  });

program
  .command('cancel <id>')
  .description('Cancel an email that has not been handed to delivery')
  .action(async (id) => {
    await getClient().emails.cancel(id);
    console.log(`Canceled ${id}`);
  });

program
  .command('webhook:replay <id>')
  .description('Redeliver failed events to a webhook endpoint')
  .option('--after <iso>', 'Failed deliveries created at or after this time')
  .option('--event <id...>', 'Specific event ids, whatever their status')
  .action(async (id, opts) => {
    const { replayed } = await getClient().webhooks.replay(id, { after: opts.after, event_ids: opts.event });
    console.log(`Replaying ${replayed} deliveries`);
  });

program
  .command('template:preview <slug>')
  .description('Render a template without sending')
  .option('--vars <json>', 'Variables as JSON', '{}')
  .action(async (slug, opts) => {
    const preview = await getClient().templates.preview(slug, { variables: JSON.parse(opts.vars) });
    console.log(`Subject: ${preview.subject}\n\n${preview.text}`);
  });

program.parseAsync().catch((err) => {
  if (err.name === 'PostlyApiError') {
    console.error(`API Error (${err.status}): ${err.message}`);
  } else {
    console.error(err.message);
  }
  process.exit(1);
});
