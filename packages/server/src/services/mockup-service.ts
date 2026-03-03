import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import db from '../db/connection';

async function launchBrowser() {
  try {
    const puppeteer = await import('puppeteer');
    return puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  } catch {
    throw new Error('Puppeteer is not available in this environment (serverless). Mockups can only be generated locally.');
  }
}

const MOCKUPS_DIR = path.join(__dirname, '../../mockups');

function ensureMockupsDir() {
  if (!fs.existsSync(MOCKUPS_DIR)) {
    fs.mkdirSync(MOCKUPS_DIR, { recursive: true });
  }
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
  return new Anthropic({ apiKey });
}

export async function screenshotWebsite(url: string): Promise<Buffer> {
  let normalizedUrl = url;
  if (!normalizedUrl.startsWith('http')) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(normalizedUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    // Wait for page to settle
    await new Promise(resolve => setTimeout(resolve, 1000));
    const screenshot = await page.screenshot({ type: 'png', fullPage: false });
    return Buffer.from(screenshot);
  } finally {
    await browser.close();
  }
}

export async function generateRedesignHTML(
  screenshotBase64: string,
  contact: any
): Promise<string> {
  const client = getClient();

  let outdatedTech: string[] = [];
  try {
    outdatedTech = JSON.parse(contact.outdated_tech || '[]');
  } catch {}

  const prompt = `Analyzuj tento screenshot webu firmy "${contact.business_name || contact.domain}" a vytvoř moderní redesign jako kompletní HTML s inline CSS.

Data o webu:
- Obor: ${contact.category || 'neznámý'}
- Město: ${contact.city || 'neznámé'}
- Problémy: ${outdatedTech.join(', ') || 'žádné specifické'}
- CMS: ${contact.cms || 'neznámý'}
- Score zastaralosti: ${contact.score || 0}/100

Požadavky na redesign:
1. Zachovej identitu firmy (barvy, logo pokud je vidět, název)
2. Moderní, čistý design s velkým hero sekcí
3. Mobilní optimalizace (responsive)
4. Kvalitní typografie (použij Google Fonts - Inter nebo Poppins)
5. Gradient nebo moderní barvy
6. Jasná CTA tlačítka
7. Sekce: Hero, Služby, O nás, Kontakt
8. Footer s kontaktními údaji

Vrať POUZE HTML kód (kompletní stránku s <html>, <head>, <body>), bez žádného dalšího textu.
HTML musí být plně samostatný s inline <style> v <head>.
Viewport: 1280x900px.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: screenshotBase64,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  // Extract HTML from potential markdown code block
  const htmlMatch = text.match(/```html\s*([\s\S]*?)```/) || text.match(/(<html[\s\S]*<\/html>)/i);
  return htmlMatch?.[1]?.trim() || text;
}

export async function renderMockupImage(html: string): Promise<Buffer> {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 500));
    const screenshot = await page.screenshot({ type: 'png', fullPage: false });
    return Buffer.from(screenshot);
  } finally {
    await browser.close();
  }
}

export async function generateMockup(contactId: number): Promise<{
  originalPath: string;
  mockupPath: string;
  htmlPath: string;
}> {
  ensureMockupsDir();

  const contact = await db.get('SELECT * FROM contacts WHERE id = ?', contactId);
  if (!contact) throw new Error('Contact not found');

  const url = contact.url || contact.domain;
  if (!url) throw new Error('Contact has no URL or domain');

  // Step 1: Screenshot the original website
  const originalScreenshot = await screenshotWebsite(url);
  const originalPath = path.join(MOCKUPS_DIR, `${contactId}_original.png`);
  fs.writeFileSync(originalPath, originalScreenshot);

  // Step 2: Send screenshot to Claude Vision for redesign HTML
  const screenshotBase64 = originalScreenshot.toString('base64');
  const redesignHTML = await generateRedesignHTML(screenshotBase64, contact);
  const htmlPath = path.join(MOCKUPS_DIR, `${contactId}_redesign.html`);
  fs.writeFileSync(htmlPath, redesignHTML, 'utf-8');

  // Step 3: Render the redesign HTML to an image
  const mockupImage = await renderMockupImage(redesignHTML);
  const mockupPath = path.join(MOCKUPS_DIR, `${contactId}_mockup.png`);
  fs.writeFileSync(mockupPath, mockupImage);

  return { originalPath, mockupPath, htmlPath };
}

export function getMockupPaths(contactId: number) {
  const originalPath = path.join(MOCKUPS_DIR, `${contactId}_original.png`);
  const mockupPath = path.join(MOCKUPS_DIR, `${contactId}_mockup.png`);
  const htmlPath = path.join(MOCKUPS_DIR, `${contactId}_redesign.html`);

  return {
    originalExists: fs.existsSync(originalPath),
    mockupExists: fs.existsSync(mockupPath),
    htmlExists: fs.existsSync(htmlPath),
    originalPath,
    mockupPath,
    htmlPath,
  };
}
