import Anthropic from '@anthropic-ai/sdk';
import db from '../db/connection';

const RATE_LIMIT = {
  perMinute: 5,
  perHour: 50,
  calls: [] as number[],
};

function checkRateLimit(): boolean {
  const now = Date.now();
  RATE_LIMIT.calls = RATE_LIMIT.calls.filter(t => now - t < 3600000);

  const lastMinute = RATE_LIMIT.calls.filter(t => now - t < 60000).length;
  const lastHour = RATE_LIMIT.calls.length;

  if (lastMinute >= RATE_LIMIT.perMinute || lastHour >= RATE_LIMIT.perHour) {
    return false;
  }

  RATE_LIMIT.calls.push(now);
  return true;
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
  return new Anthropic({ apiKey });
}

const SYSTEM_PROMPT = `Jsi zkušený copywriter pro českou webovou agenturu Weblyx (weblyx.cz). Píšeš přesvědčivé, personalizované emaily firmám, které mají zastaralé webové stránky.

Pravidla:
- Piš vždy v češtině, formálně ale přátelsky (vykání)
- Email musí být krátký a věcný (max 150 slov)
- Začni konkrétním pozorováním o jejich webu (ne obecnou frází)
- Zmiň 2-3 konkrétní problémy z dat
- Nabídni bezplatnou 15min konzultaci
- Podpis: jméno odesílatele + weblyx.cz
- NIKDY nepoužívej agresivní prodejní taktiky
- NIKDY nelži o problémech - zmiň jen ty, které skutečně existují
- Nepoužívej emoji

Formát odpovědi (striktně dodržuj):
SUBJECT: [předmět emailu]
---HTML---
[HTML verze emailu s <p>, <strong>, <ul> tagy pro formátování]
---TEXT---
[Čistě textová verze emailu]`;

export async function generateEmailForContact(contactId: number): Promise<{
  subject: string;
  body_html: string;
  body_text: string;
}> {
  if (!checkRateLimit()) {
    throw new Error('Rate limit exceeded. Max 5 calls/minute, 50/hour.');
  }

  const contact = await db.get('SELECT * FROM contacts WHERE id = ?', contactId);
  if (!contact) throw new Error('Contact not found');

  let outdatedTech: string[] = [];
  try {
    outdatedTech = JSON.parse(contact.outdated_tech || '[]');
  } catch {}

  const contactData = `
Firma: ${contact.business_name || 'neznámá'}
Web: ${contact.domain || contact.url || 'neznámý'}
Obor: ${contact.category || 'neznámý'}
Město: ${contact.city || 'neznámé'}
Kontaktní osoba: ${contact.contact_name || 'neuvedena'}
Score zastaralosti: ${contact.score || 0}/100
CMS: ${contact.cms || 'neznámý'}
Mobilní optimalizace: ${contact.mobile_friendly ? 'ano' : 'ne'}
SSL certifikát: ${contact.ssl_valid ? 'ano' : 'ne'}
Copyright rok: ${contact.copyright_year || 'neuvedeno'}
Rychlost načtení: ${contact.load_time ? contact.load_time + 's' : 'neměřeno'}
Nalezené problémy: ${outdatedTech.length > 0 ? outdatedTech.join(', ') : 'žádné specifické'}
Odesílatel: ${process.env.SENDER_NAME || 'Weblyx'}
`.trim();

  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Napiš personalizovaný email pro tuto firmu:\n\n${contactData}`,
      },
    ],
  });

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  const subjectMatch = text.match(/SUBJECT:\s*(.+)/);
  const htmlMatch = text.match(/---HTML---\s*([\s\S]*?)---TEXT---/);
  const textMatch = text.match(/---TEXT---\s*([\s\S]*?)$/);

  const subject = subjectMatch?.[1]?.trim() || `${contact.business_name || contact.domain} - Modernizace webu`;
  const bodyHtml = htmlMatch?.[1]?.trim() || text;
  const bodyText = textMatch?.[1]?.trim() || text.replace(/<[^>]*>/g, '');

  return {
    subject,
    body_html: bodyHtml,
    body_text: bodyText,
  };
}

export async function getRateLimitStatus() {
  const now = Date.now();
  const recentCalls = RATE_LIMIT.calls.filter(t => now - t < 3600000);
  const lastMinute = recentCalls.filter(t => now - t < 60000).length;
  return {
    calls_last_minute: lastMinute,
    calls_last_hour: recentCalls.length,
    limit_per_minute: RATE_LIMIT.perMinute,
    limit_per_hour: RATE_LIMIT.perHour,
  };
}
