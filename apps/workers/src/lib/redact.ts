/** Keeps logs free of PII: first three characters of the local part, then the domain. */
export function redactAddress(addr: string): string {
  const [local, domain] = addr.split('@');
  if (!local || !domain) return '***';
  return `${local.slice(0, 3)}***@${domain}`;
}
