import { createHmac } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnvLocal(): Record<string, string> {
  try {
    const raw = readFileSync(resolve(process.cwd(), 'apps/web/.env.local'), 'utf-8');
    return Object.fromEntries(
      raw
        .split('\n')
        .filter((line) => line.trim() && !line.startsWith('#'))
        .map((line) => {
          const idx = line.indexOf('=');
          return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

async function main() {
  const env = loadEnvLocal();
  const secret = env['ALCHEMY_WEBHOOK_SECRET'] ?? '';

  if (!secret) {
    console.warn('Warning: ALCHEMY_WEBHOOK_SECRET not found in .env.local — signature will be wrong');
  }

  const payload = {
    webhookId: 'wh_test_000000000001',
    id: 'evt_test_000000000001',
    createdAt: new Date().toISOString(),
    type: 'ADDRESS_ACTIVITY',
    event: {
      network: 'ETH_MAINNET',
      activity: [
        {
          fromAddress: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
          toAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
          blockNum: '0x1388',
          hash: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
          value: 1.5,
          asset: 'ETH',
          category: 'external',
          rawContract: {},
        },
      ],
    },
  };

  const body = JSON.stringify(payload);
  const signature = createHmac('sha256', secret).update(body).digest('hex');

  console.log('POST http://localhost:3000/api/webhooks/alchemy');
  console.log('x-alchemy-signature:', signature);
  console.log('body:', body, '\n');

  const res = await fetch('http://localhost:3000/api/webhooks/alchemy', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-alchemy-signature': signature,
    },
    body,
  });

  const text = await res.text();
  console.log(`response: ${res.status} ${res.statusText}`);
  console.log(text);
}

main();
