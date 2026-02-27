import { Router, Request, Response } from 'express';
import db from '../db/connection';

const router = Router();

// ──── Helpers ────

function extractEmails(html: string): string[] {
  const re = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const found = html.match(re) || [];
  // Filter out common false positives
  const blocked = ['wixpress', 'sentry', 'webpack', 'example', 'email.com', 'domain.com'];
  return [...new Set(found.filter(e =>
    !blocked.some(b => e.includes(b)) && !e.endsWith('.png') && !e.endsWith('.jpg')
  ))];
}

function extractPhones(html: string): string[] {
  // Strip HTML tags to avoid picking up IDs/attributes
  const text = html.replace(/<[^>]+>/g, ' ');

  // Czech phone patterns: +420 XXX XXX XXX, 420 XXX XXX XXX
  const withPrefix = /(?:\+420|00420)[\s\-\.]*(\d{3})[\s\-\.]*(\d{3})[\s\-\.]*(\d{3})/g;
  // Standalone 9 digits starting with valid Czech prefixes (6,7 = mobile, 2-5 = landline)
  const standalone = /(?<!\d)([2-7]\d{2})[\s\-\.]+(\d{3})[\s\-\.]+(\d{3})(?!\d)/g;

  const phones: string[] = [];
  let m;

  while ((m = withPrefix.exec(text)) !== null) {
    phones.push(`+420${m[1]}${m[2]}${m[3]}`);
  }
  while ((m = standalone.exec(text)) !== null) {
    phones.push(`+420${m[1]}${m[2]}${m[3]}`);
  }

  return [...new Set(phones)];
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim().replace(/\s+/g, ' ') : '';
}

function extractMeta(html: string, name: string): string {
  const re = new RegExp(`<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
  const m = html.match(re);
  if (m) return m[1].trim();
  // Try reversed attribute order
  const re2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, 'i');
  const m2 = html.match(re2);
  return m2 ? m2[1].trim() : '';
}

function detectCMS(html: string): { cms: string; version: string } {
  const lower = html.toLowerCase();
  if (lower.includes('wp-content') || lower.includes('wordpress')) {
    const vm = html.match(/ver=(\d+\.\d+[\.\d]*)/);
    return { cms: 'WordPress', version: vm ? vm[1] : '' };
  }
  if (lower.includes('joomla')) return { cms: 'Joomla', version: '' };
  if (lower.includes('drupal')) return { cms: 'Drupal', version: '' };
  if (lower.includes('shoptet')) return { cms: 'Shoptet', version: '' };
  if (lower.includes('shopify')) return { cms: 'Shopify', version: '' };
  if (lower.includes('wix.com') || lower.includes('wixsite')) return { cms: 'Wix', version: '' };
  if (lower.includes('squarespace')) return { cms: 'Squarespace', version: '' };
  if (lower.includes('webnode')) return { cms: 'Webnode', version: '' };
  if (lower.includes('eshop-rychle')) return { cms: 'Eshop-rychle', version: '' };
  if (lower.includes('prestashop')) return { cms: 'PrestaShop', version: '' };
  if (lower.includes('magento')) return { cms: 'Magento', version: '' };
  if (lower.includes('opencart')) return { cms: 'OpenCart', version: '' };
  if (lower.includes('webareal')) return { cms: 'WebAreal', version: '' };
  if (lower.includes('solid-pixels') || lower.includes('solidpixels')) return { cms: 'SolidPixels', version: '' };
  return { cms: '', version: '' };
}

function detectCopyrightYear(html: string): number | null {
  // Look for © or &copy; followed by year
  const re = /(?:©|&copy;|copyright)\s*(\d{4})/gi;
  let match;
  let latestYear: number | null = null;
  while ((match = re.exec(html)) !== null) {
    const year = parseInt(match[1]);
    if (year >= 2000 && year <= 2030) {
      if (!latestYear || year > latestYear) latestYear = year;
    }
  }
  return latestYear;
}

function detectOutdatedTech(html: string): string[] {
  const issues: string[] = [];
  const lower = html.toLowerCase();

  if (lower.includes('jquery/1.') || lower.includes('jquery-1.') || lower.includes('jquery.min.js?v=1'))
    issues.push('jQuery 1.x');
  if (lower.includes('bootstrap/3.') || lower.includes('bootstrap-3.'))
    issues.push('Bootstrap 3');
  if (lower.includes('bootstrap/2.'))
    issues.push('Bootstrap 2');
  if (lower.includes('font-awesome/4.'))
    issues.push('FontAwesome 4');

  // Meta viewport missing = not mobile friendly
  if (!lower.includes('viewport'))
    issues.push('Chybí viewport meta');

  // No HTTPS redirect info in HTML (checked externally via SSL)

  // Flash
  if (lower.includes('swfobject') || lower.includes('.swf') || lower.includes('shockwave-flash'))
    issues.push('Flash');

  // Table layout
  const tableCount = (lower.match(/<table/g) || []).length;
  if (tableCount > 5 && !lower.includes('datatable'))
    issues.push('Tabulkový layout');

  return issues;
}

function checkMobileFriendly(html: string): boolean {
  return html.toLowerCase().includes('viewport');
}

async function analyzeUrl(url: string): Promise<any> {
  // Normalize URL
  if (!url.startsWith('http')) url = 'https://' + url;
  const domain = new URL(url).hostname.replace(/^www\./, '');

  const startTime = Date.now();
  let html = '';
  let sslValid = false;
  let finalUrl = url;

  try {
    // Try HTTPS first
    const httpsUrl = url.replace(/^http:\/\//, 'https://');
    const resp = await fetch(httpsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZenulyCRM/1.0)' },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    html = await resp.text();
    sslValid = true;
    finalUrl = resp.url;
  } catch {
    try {
      // Fallback to HTTP
      const httpUrl = url.replace(/^https:\/\//, 'http://');
      const resp = await fetch(httpUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ZenulyCRM/1.0)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      });
      html = await resp.text();
      finalUrl = resp.url;
    } catch (err: any) {
      return { error: `Nepodařilo se načíst ${url}: ${err.message}` };
    }
  }

  const loadTime = (Date.now() - startTime) / 1000;
  const emails = extractEmails(html);
  const phones = extractPhones(html);
  const title = extractTitle(html);
  const description = extractMeta(html, 'description');
  const { cms, version: cmsVersion } = detectCMS(html);
  const copyrightYear = detectCopyrightYear(html);
  const outdatedTech = detectOutdatedTech(html);
  const mobileFriendly = checkMobileFriendly(html);

  // Calculate score: higher = more outdated = better lead
  let score = 0;
  if (!sslValid) score += 25;
  if (!mobileFriendly) score += 25;
  if (copyrightYear && copyrightYear < new Date().getFullYear() - 1) score += 20;
  if (outdatedTech.length > 0) score += outdatedTech.length * 10;
  if (loadTime > 3) score += 15;
  if (loadTime > 5) score += 10;
  score = Math.min(score, 100);

  // Extract business name: prefer og:site_name > title parts > domain
  const ogSiteName = extractMeta(html, 'og:site_name');
  const titleParts = title.split(/[\-–|»]/).map(s => s.trim()).filter(Boolean);
  const genericTitles = ['úvodní stránka', 'homepage', 'home', 'hlavní stránka', 'vítejte'];
  const bestTitle = titleParts.find(p => !genericTitles.includes(p.toLowerCase())) || titleParts[0] || '';
  const businessName = ogSiteName || bestTitle || domain;

  return {
    url: finalUrl,
    domain,
    business_name: businessName,
    email: emails[0] || null,
    phone: phones[0] || null,
    all_emails: emails,
    all_phones: phones,
    title,
    description,
    cms,
    cms_version: cmsVersion,
    copyright_year: copyrightYear,
    ssl_valid: sslValid,
    mobile_friendly: mobileFriendly,
    load_time: Math.round(loadTime * 100) / 100,
    outdated_tech: outdatedTech,
    score,
  };
}

// ──── Routes ────

// POST /api/scanner/analyze - Analyze a single URL
router.post('/analyze', async (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL je povinné' });

  const result = await analyzeUrl(url);
  res.json(result);
});

// POST /api/scanner/bulk-analyze - Analyze multiple URLs
router.post('/bulk-analyze', async (req: Request, res: Response) => {
  const { urls } = req.body;
  if (!Array.isArray(urls) || urls.length === 0)
    return res.status(400).json({ error: 'Zadejte pole URL adres' });

  // Limit to 20 URLs at once
  const batch = urls.slice(0, 20);
  const results = await Promise.allSettled(batch.map(u => analyzeUrl(u)));

  res.json(results.map((r, i) => ({
    url: batch[i],
    ...(r.status === 'fulfilled' ? r.value : { error: r.reason?.message || 'Chyba' }),
  })));
});

// POST /api/scanner/save - Save scanned result as contact
router.post('/save', async (req: Request, res: Response) => {
  const {
    business_name, url, domain, email, phone,
    cms, cms_version, copyright_year, ssl_valid, mobile_friendly,
    load_time, outdated_tech, score, contact_name, category, city, notes
  } = req.body;

  // Check if domain already exists
  if (domain) {
    const existing = await db.get('SELECT id FROM contacts WHERE domain = ?', domain);
    if (existing) {
      return res.status(409).json({ error: 'Kontakt s touto doménou již existuje', existingId: existing.id });
    }
  }

  const result = await db.run(`
    INSERT INTO contacts (
      business_name, url, domain, email, phone, contact_name,
      category, city, source, score,
      cms, cms_version, copyright_year, ssl_valid, mobile_friendly,
      load_time, outdated_tech, notes, tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'web_scan', ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')
  `,
    business_name || null, url || null, domain || null, email || null, phone || null, contact_name || null,
    category || null, city || null, score || 0,
    cms || null, cms_version || null, copyright_year || null,
    ssl_valid ? 1 : 0, mobile_friendly ? 1 : 0,
    load_time || null, JSON.stringify(outdated_tech || []), notes || null
  );

  await db.run(`
    INSERT INTO activities (contact_id, type, title, details) VALUES (?, 'created', 'Kontakt nalezen scannerem', ?)
  `, result.lastInsertRowid, JSON.stringify({ source: 'web_scan', url }));

  const contact = await db.get('SELECT * FROM contacts WHERE id = ?', result.lastInsertRowid);
  res.status(201).json(contact);
});

// POST /api/scanner/search - Search Google for businesses
router.post('/search', async (req: Request, res: Response) => {
  const { query, city } = req.body;
  if (!query) return res.status(400).json({ error: 'Zadejte vyhledávací dotaz' });

  const searchQuery = city ? `${query} ${city}` : query;

  // Try Google Custom Search API if configured
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;

  if (apiKey && cx) {
    try {
      const params = new URLSearchParams({
        key: apiKey, cx, q: searchQuery, num: '10', gl: 'cz', lr: 'lang_cs',
      });
      const resp = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
        signal: AbortSignal.timeout(10000),
      });
      const data: any = await resp.json();

      if (data.items) {
        const results = data.items.map((item: any) => ({
          title: item.title,
          url: item.link,
          domain: new URL(item.link).hostname.replace(/^www\./, ''),
          snippet: item.snippet,
        }));
        return res.json({ results, source: 'google' });
      }
    } catch (err: any) {
      console.error('Google search error:', err.message);
    }
  }

  // Fallback: return instructions to configure Google API
  res.json({
    results: [],
    source: 'none',
    message: 'Pro vyhledávání nastavte GOOGLE_API_KEY a GOOGLE_CX v prostředí. ' +
      'Alternativně můžete zadat URL adresy přímo do skeneru.',
  });
});

export default router;
