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

const SYSTEM_PROMPT = `Jsi zkušený copywriter pro českou webovou agenturu Weblyx (weblyx.cz). Píšeš cold outreach emaily firmám se zastaralými weby.

NABÍDKA WEBLYX:
- Landing Page: 7 900 Kč (jednoduchý web)
- Základní Web: 9 990 Kč (blog, CMS, SEO, 3-5 podstránek, moderní design, dodání 5-7 dní, 2 měsíce podpora)
- Bezplatná 15min konzultace
- Kontakt: info@weblyx.cz

FRAMEWORK (PAS):
1. PROBLÉM: Začni konkrétním pozorováním o jejich webu (co jsi našel).
2. AGITACE: Jak to ovlivňuje jejich podnikání (ztráta zákazníků, SEO penalizace, špatný dojem).
3. ŘEŠENÍ: Nabídni bezplatnou konzultaci. V prvním emailu NEZMIŇUJ cenu.

PRAVIDLA:
- Čeština, vykání, profesionálně ale přátelsky
- Max 120 slov (lidé čtou na mobilu)
- Začni pozorováním o webu, NE "Dobrý den, jmenuji se..."
- Zmiň max 2 problémy (ne celý seznam)
- CTA: jednoduchá otázka (snižuje bariéru odpovědi)
- NIKDY nelži o problémech — zmiň jen ty, které skutečně existují
- NIKDY nepoužívej agresivní taktiky ani emoji
- Podpis: jméno odesílatele | Weblyx.cz | info@weblyx.cz

PŘÍKLADY DOBRÝCH PŘEDMĚTŮ:
- "{{firma}} - všiml jsem si něčeho na vašem webu"
- "Otázka k {{web}}"
- "{{firma}} - krátká poznámka"

Formát odpovědi (striktně dodržuj):
SUBJECT: [předmět emailu — krátký, vyvolávající zvědavost]
---HTML---
[HTML verze s <p>, <strong>, <ul> tagy]
---TEXT---
[Čistě textová verze]`;


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
