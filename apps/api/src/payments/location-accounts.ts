import { Inject, Injectable } from '@nestjs/common';
import type { Location } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider';
import { PayOsProvider, payOsConfigFromEnv, type PayOsConfig } from './payos-provider';
import { openSecret } from './secret-box';

type LocationKeys = Pick<Location, 'payosClientId' | 'payosApiKey' | 'payosChecksumKey'>;

/** Счёт, на который идут оплаты: `locationId` — свой счёт точки, null — общий провайдер из .env. */
export interface PaymentAccount {
  provider: PaymentProvider;
  locationId: string | null;
}

/** Адрес webhook точки: payOS вызывает его с подписью её ключом. */
export function locationWebhookUrl(locationId: string, env: NodeJS.ProcessEnv = process.env): string {
  return `${(env.API_PUBLIC_URL ?? '').replace(/\/$/, '')}/api/webhooks/payos/${locationId}`;
}

export function locationPayOsConfig(loc: LocationKeys, env: NodeJS.ProcessEnv = process.env): PayOsConfig | null {
  if (!loc.payosClientId || !loc.payosApiKey || !loc.payosChecksumKey) return null;
  const base = payOsConfigFromEnv({ ...env, PAYOS_CLIENT_ID: loc.payosClientId, PAYOS_API_KEY: openSecret(loc.payosApiKey, env), PAYOS_CHECKSUM_KEY: openSecret(loc.payosChecksumKey, env) });
  return base;
}

@Injectable()
export class LocationAccounts {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private readonly fallback: PaymentProvider,
  ) {}

  get platform(): PaymentProvider {
    return this.fallback;
  }

  /** Свои ключи точки — её счёт; без них — общий провайдер (payOS из .env, тестовый или выключенный). */
  async forLocation(locationId: string): Promise<PaymentAccount> {
    const loc = await this.prisma.location.findUnique({ where: { id: locationId }, select: { payosClientId: true, payosApiKey: true, payosChecksumKey: true } });
    const cfg = loc && locationPayOsConfig(loc);
    return cfg ? { provider: new PayOsProvider(cfg), locationId } : { provider: this.fallback, locationId: null };
  }
}
