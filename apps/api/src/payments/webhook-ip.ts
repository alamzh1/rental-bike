// Webhook принимается только с IP из PAYOS_WEBHOOK_IPS (через запятую), если список задан (история 86).
// За обратным прокси нужен корректный req.ip (trust proxy).
export function normalizeIp(ip: string | undefined): string {
  return (ip ?? '').trim().replace(/^::ffff:/, '');
}

export function webhookIpAllowed(ip: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  const list = (env.PAYOS_WEBHOOK_IPS ?? '').split(',').map((s) => normalizeIp(s)).filter(Boolean);
  if (list.length === 0) return true;
  return list.includes(normalizeIp(ip));
}
