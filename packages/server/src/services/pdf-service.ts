import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import db from '../db/connection';

const MOCKUPS_DIR = path.join(__dirname, '../../mockups');

function ensureDir() {
  if (!fs.existsSync(MOCKUPS_DIR)) {
    fs.mkdirSync(MOCKUPS_DIR, { recursive: true });
  }
}

// Helper: rounded rectangle
function roundedRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, r: number) {
  doc.moveTo(x + r, y)
    .lineTo(x + w - r, y)
    .quadraticCurveTo(x + w, y, x + w, y + r)
    .lineTo(x + w, y + h - r)
    .quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    .lineTo(x + r, y + h)
    .quadraticCurveTo(x, y + h, x, y + h - r)
    .lineTo(x, y + r)
    .quadraticCurveTo(x, y, x + r, y);
}

export async function generateProposalPdf(contactId: number): Promise<string> {
  ensureDir();

  const contact = await db.get('SELECT * FROM contacts WHERE id = ?', contactId);
  if (!contact) throw new Error('Contact not found');

  let outdatedTech: string[] = [];
  try { outdatedTech = JSON.parse(contact.outdated_tech || '[]'); } catch {}

  const pdfPath = path.join(MOCKUPS_DIR, `${contactId}_nabidka.pdf`);
  const W = 595.28; // A4 width
  const H = 841.89; // A4 height

  const firmName = contact.business_name || contact.domain || 'vasi firmu';
  const today = new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });

  // Colors
  const primary = '#2563EB';    // bright blue
  const primaryDark = '#1E40AF';
  const dark = '#111827';
  const text = '#374151';
  const textLight = '#6B7280';
  const accent = '#3B82F6';
  const red = '#DC2626';
  const orange = '#EA580C';
  const green = '#16A34A';
  const bgLight = '#F9FAFB';
  const border = '#E5E7EB';
  const white = '#FFFFFF';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
    const stream = fs.createWriteStream(pdfPath);
    doc.pipe(stream);

    // =============================================
    // PAGE 1: Cover
    // =============================================

    // Full page dark gradient background
    doc.rect(0, 0, W, H).fill(dark);

    // Subtle geometric decoration - diagonal line
    doc.save();
    doc.moveTo(W * 0.6, 0).lineTo(W, H * 0.4).lineTo(W, 0).closePath().fill('#1a2744');
    doc.restore();

    // Top accent bar
    doc.rect(0, 0, W, 5).fill(primary);

    // Logo area
    doc.fontSize(32).fillColor(white).text('W', 60, 60, { continued: true })
       .fillColor(primary).text('eblyx', { continued: false });
    doc.fontSize(11).fillColor('#9CA3AF').text('webova agentura', 60, 98);

    // Divider line
    doc.moveTo(60, 140).lineTo(200, 140).lineWidth(2).strokeColor(primary).stroke();

    // Main title
    doc.fontSize(14).fillColor(primary).text('NABIDKA', 60, 200);
    doc.fontSize(36).fillColor(white).text(`pro ${firmName}`, 60, 225, { width: 475, lineGap: 4 });

    // Info cards
    const infoY = 340;
    const infoItems = [
      ['Datum', today],
      ['Web', contact.domain || contact.url || '-'],
      ['Kontakt', contact.contact_name || contact.email || '-'],
    ];

    infoItems.forEach((item, i) => {
      const iy = infoY + i * 55;
      doc.fontSize(9).fillColor('#9CA3AF').text(item[0].toUpperCase(), 60, iy);
      doc.fontSize(14).fillColor(white).text(item[1], 60, iy + 16, { width: 400 });
    });

    // Bottom tagline
    doc.fontSize(13).fillColor('#9CA3AF').text(
      'Pripravili jsme pro vas analyzu vaseho soucasneho webu\na navrh, jak ho posunout na dalsi uroven.',
      60, H - 160, { width: 400, lineGap: 6 }
    );

    // Bottom accent
    doc.rect(0, H - 5, W, 5).fill(primary);

    // =============================================
    // PAGE 2: Analysis
    // =============================================
    doc.addPage({ margin: 0 });

    // Top bar
    doc.rect(0, 0, W, 80).fill(primary);
    doc.fontSize(9).fillColor('rgba(255,255,255,0.7)').text('WEBLYX', 60, 20);
    doc.fontSize(22).fillColor(white).text('Analyza webu', 60, 38);

    let y = 110;

    // Score section
    doc.save();
    roundedRect(doc, 40, y, W - 80, 120, 12);
    doc.fill(bgLight);
    doc.restore();

    const score = contact.score || 0;
    const scoreCol = score > 60 ? red : score > 30 ? orange : green;
    const scoreLabel = score > 60 ? 'Kriticky zastaraly' : score > 30 ? 'Potrebuje modernizaci' : 'V poradku';

    // Score number
    doc.fontSize(48).fillColor(scoreCol).text(`${score}`, 70, y + 18, { width: 80 });
    doc.fontSize(11).fillColor(textLight).text('/ 100', 70, y + 72, { width: 80 });

    // Score bar
    const barX = 180;
    const barW = W - 80 - 180;
    doc.rect(barX, y + 35, barW, 12).fill(border);
    doc.save();
    roundedRect(doc, barX, y + 35, Math.max((score / 100) * barW, 8), 12, 6);
    doc.fill(scoreCol);
    doc.restore();

    doc.fontSize(14).fillColor(dark).text(scoreLabel, barX, y + 18);
    doc.fontSize(10).fillColor(textLight).text(
      'Cim vyssi cislo, tim vice je web zastaraly a potrebuje modernizaci.',
      barX, y + 58, { width: barW }
    );

    y += 150;

    // Technical details - card grid
    const details = [
      { label: 'SSL certifikat', value: contact.ssl_valid ? 'Platny' : 'Chybi!', ok: !!contact.ssl_valid, icon: contact.ssl_valid ? 'OK' : 'X' },
      { label: 'Mobilni optimalizace', value: contact.mobile_friendly ? 'Ano' : 'Chybi!', ok: !!contact.mobile_friendly, icon: contact.mobile_friendly ? 'OK' : 'X' },
      { label: 'Copyright rok', value: contact.copyright_year ? String(contact.copyright_year) : '-', ok: contact.copyright_year >= 2024, icon: contact.copyright_year >= 2024 ? 'OK' : '!' },
      { label: 'CMS system', value: contact.cms || '-', ok: true, icon: 'i' },
      { label: 'Rychlost nacteni', value: contact.load_time ? `${contact.load_time}s` : '-', ok: !contact.load_time || contact.load_time <= 3, icon: contact.load_time > 3 ? '!' : 'OK' },
      { label: 'Technologie', value: outdatedTech.length > 0 ? `${outdatedTech.length} problemu` : 'OK', ok: outdatedTech.length === 0, icon: outdatedTech.length > 0 ? 'X' : 'OK' },
    ];

    const cardW = (W - 80 - 20) / 2;
    const cardH = 70;

    details.forEach((d, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = 40 + col * (cardW + 20);
      const cy = y + row * (cardH + 12);

      // Card background
      doc.save();
      roundedRect(doc, cx, cy, cardW, cardH, 8);
      doc.fill(white);
      doc.restore();

      // Left border accent
      const accentColor = d.ok ? green : red;
      doc.rect(cx, cy + 10, 3, cardH - 20).fill(accentColor);

      doc.fontSize(9).fillColor(textLight).text(d.label.toUpperCase(), cx + 18, cy + 15, { width: cardW - 30 });
      doc.fontSize(15).fillColor(d.ok ? dark : red).text(d.value, cx + 18, cy + 32, { width: cardW - 30 });
    });

    y += 3 * (cardH + 12) + 20;

    // Problems list
    if (outdatedTech.length > 0) {
      doc.fontSize(14).fillColor(dark).text('Nalezene problemy', 40, y);
      y += 28;

      outdatedTech.forEach(tech => {
        doc.save();
        roundedRect(doc, 40, y, W - 80, 28, 6);
        doc.fill('#FEF2F2');
        doc.restore();

        doc.fontSize(10).fillColor(red).text('!', 54, y + 8);
        doc.fontSize(10).fillColor('#991B1B').text(tech, 72, y + 8, { width: W - 130 });
        y += 34;
      });
    }

    // Impact section
    y += 15;
    doc.fontSize(14).fillColor(dark).text('Dopad na vase podnikani', 40, y);
    y += 28;

    const impacts = [
      'Zakaznici odchazi ke konkurenci s modernim webem',
      'Google penalizuje zastarale weby ve vyhledavani',
      'Bez mobilni optimalizace ztracite az 60 % navstevniku',
      'Pomaly web snizuje konverzni pomer o 7 % za kazdou sekundu',
    ];

    impacts.forEach(impact => {
      doc.fontSize(10).fillColor(accent).text('>', 50, y);
      doc.fontSize(10).fillColor(text).text(impact, 68, y, { width: W - 130 });
      y += 20;
    });

    // =============================================
    // PAGE 3: Mockup (if exists)
    // =============================================
    const mockupPath = path.join(MOCKUPS_DIR, `${contactId}_mockup.png`);
    if (fs.existsSync(mockupPath)) {
      doc.addPage({ margin: 0 });

      doc.rect(0, 0, W, 80).fill(primary);
      doc.fontSize(9).fillColor('rgba(255,255,255,0.7)').text('WEBLYX', 60, 20);
      doc.fontSize(22).fillColor(white).text('Navrh noveho webu', 60, 38);

      doc.fontSize(11).fillColor(textLight).text(
        'Takto by mohl vypadat vas modernizovany web:',
        40, 100, { width: W - 80 }
      );

      try {
        // Browser chrome frame
        doc.save();
        roundedRect(doc, 40, 130, W - 80, 16, 8);
        doc.fill('#E5E7EB');
        doc.restore();
        doc.circle(54, 138, 3).fill('#EF4444');
        doc.circle(66, 138, 3).fill('#F59E0B');
        doc.circle(78, 138, 3).fill('#22C55E');

        doc.image(mockupPath, 40, 146, { width: W - 80, height: 560 });

        // Shadow
        doc.save();
        doc.rect(40, 706, W - 80, 4).fill('#00000010');
        doc.restore();
      } catch {
        doc.fontSize(11).fillColor(textLight).text('(Nahled nebyl k dispozici)', 40, 150);
      }
    }

    // =============================================
    // PAGE 4: Pricing
    // =============================================
    doc.addPage({ margin: 0 });

    doc.rect(0, 0, W, 80).fill(primary);
    doc.fontSize(9).fillColor('rgba(255,255,255,0.7)').text('WEBLYX', 60, 20);
    doc.fontSize(22).fillColor(white).text('Cenove balicky', 60, 38);

    doc.fontSize(11).fillColor(textLight).text(
      'Vyberte si balicek, ktery nejlepe odpovida vasim potrebam.',
      40, 100, { width: W - 80 }
    );

    const pkgY = 135;
    const pkgW = (W - 100) / 2;
    const pkgH = 420;

    // Package 1: Landing Page
    doc.save();
    roundedRect(doc, 40, pkgY, pkgW, pkgH, 12);
    doc.lineWidth(1).strokeColor(border).stroke();
    doc.restore();

    doc.fontSize(11).fillColor(textLight).text('ZAKLADNI', 40, pkgY + 25, { width: pkgW, align: 'center' });
    doc.fontSize(20).fillColor(dark).text('Landing Page', 40, pkgY + 45, { width: pkgW, align: 'center' });

    // Price
    doc.fontSize(36).fillColor(primary).text('7 900', 40, pkgY + 85, { width: pkgW, align: 'center' });
    doc.fontSize(11).fillColor(textLight).text('CZK jednorázove', 40, pkgY + 125, { width: pkgW, align: 'center' });

    // Divider
    doc.moveTo(65, pkgY + 155).lineTo(40 + pkgW - 25, pkgY + 155).lineWidth(1).strokeColor(border).stroke();

    const pkg1Features = [
      'Moderni responzivni design',
      'Kontaktni formular',
      '1-2 podstranky',
      'Zakladni SEO optimalizace',
      'Rychle nacteni',
      'Dodani za 3-5 dni',
    ];

    let py = pkgY + 175;
    pkg1Features.forEach(f => {
      doc.fontSize(10).fillColor(green).text('*', 65, py);
      doc.fontSize(10).fillColor(text).text(f, 82, py, { width: pkgW - 60 });
      py += 24;
    });

    // Package 2: Basic Web (highlighted)
    const pkg2X = 60 + pkgW;
    doc.save();
    roundedRect(doc, pkg2X, pkgY - 10, pkgW, pkgH + 20, 12);
    doc.fill(primary);
    doc.restore();

    // Popular badge
    doc.save();
    roundedRect(doc, pkg2X + pkgW / 2 - 50, pkgY - 5, 100, 22, 11);
    doc.fill(white);
    doc.restore();
    doc.fontSize(8).fillColor(primary).text('NEJOBLIBENEJSI', pkg2X + pkgW / 2 - 50, pkgY, { width: 100, align: 'center' });

    doc.fontSize(11).fillColor('rgba(255,255,255,0.7)').text('KOMPLETNI', pkg2X, pkgY + 30, { width: pkgW, align: 'center' });
    doc.fontSize(20).fillColor(white).text('Zakladni Web', pkg2X, pkgY + 50, { width: pkgW, align: 'center' });

    // Price
    doc.fontSize(36).fillColor(white).text('9 990', pkg2X, pkgY + 90, { width: pkgW, align: 'center' });
    doc.fontSize(11).fillColor('rgba(255,255,255,0.7)').text('CZK jednorázove', pkg2X, pkgY + 130, { width: pkgW, align: 'center' });

    // Divider
    doc.moveTo(pkg2X + 25, pkgY + 160).lineTo(pkg2X + pkgW - 25, pkgY + 160).lineWidth(1).strokeColor('rgba(255,255,255,0.3)').stroke();

    const pkg2Features = [
      'Vse z Landing Page +',
      '3-5 podstranek',
      'Pokrocile SEO',
      'Blog s CMS editorem',
      'Napojeni na soc. site',
      'Google Analytics',
      'Dodani za 5-7 dni',
      '2 mesice podpora zdarma',
    ];

    py = pkgY + 180;
    pkg2Features.forEach(f => {
      doc.fontSize(10).fillColor('rgba(255,255,255,0.7)').text('*', pkg2X + 25, py);
      doc.fontSize(10).fillColor(white).text(f, pkg2X + 42, py, { width: pkgW - 60 });
      py += 24;
    });

    // CTA box at bottom
    const ctaY = pkgY + pkgH + 30;
    doc.save();
    roundedRect(doc, 40, ctaY, W - 80, 100, 12);
    doc.fill(bgLight);
    doc.restore();

    doc.save();
    roundedRect(doc, 40, ctaY, 4, 100, 2);
    doc.fill(primary);
    doc.restore();

    doc.fontSize(16).fillColor(dark).text('Zaujala vas nabidka?', 65, ctaY + 18, { width: W - 130 });
    doc.fontSize(11).fillColor(textLight).text(
      'Staci odpovedet na tento email nebo zavolat. Pripravime vam nezavaznou konzultaci zdarma a ukazeme, jak posunout vas web na dalsi uroven.',
      65, ctaY + 42, { width: W - 140, lineGap: 4 }
    );

    // =============================================
    // PAGE 5: About
    // =============================================
    doc.addPage({ margin: 0 });

    doc.rect(0, 0, W, 80).fill(primary);
    doc.fontSize(9).fillColor('rgba(255,255,255,0.7)').text('WEBLYX', 60, 20);
    doc.fontSize(22).fillColor(white).text('O nas', 60, 38);

    y = 110;

    doc.fontSize(12).fillColor(text).text(
      'Weblyx je ceska webova agentura zamerena na tvorbu modernich webovych stranek pro male a stredni firmy. Pomahame firmam ziskat profesionalni online prezentaci rychle a za ferovou cenu.',
      40, y, { width: W - 80, lineGap: 6 }
    );

    y += 80;

    // Services grid
    doc.fontSize(14).fillColor(dark).text('Co nabizime', 40, y);
    y += 30;

    const services = [
      { title: 'Tvorba webu', desc: 'Moderni responzivni weby na miru' },
      { title: 'Redesign', desc: 'Modernizace zastaralych webu' },
      { title: 'SEO', desc: 'Optimalizace pro vyhledavace' },
      { title: 'Automatizace', desc: 'Zefektivneni firemnich procesu' },
      { title: 'Sprava webu', desc: 'Pravidelna udrzba a aktualizace' },
      { title: 'Konzultace', desc: 'Poradenstvi v oblasti digitalu' },
    ];

    const svcW = (W - 100) / 2;
    services.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const sx = 40 + col * (svcW + 20);
      const sy = y + row * 65;

      doc.save();
      roundedRect(doc, sx, sy, svcW, 55, 8);
      doc.fill(bgLight);
      doc.restore();

      doc.rect(sx, sy + 12, 3, 30).fill(primary);
      doc.fontSize(12).fillColor(dark).text(s.title, sx + 16, sy + 12, { width: svcW - 30 });
      doc.fontSize(10).fillColor(textLight).text(s.desc, sx + 16, sy + 30, { width: svcW - 30 });
    });

    y += 3 * 65 + 30;

    // Contact info
    doc.save();
    roundedRect(doc, 40, y, W - 80, 80, 12);
    doc.fill(dark);
    doc.restore();

    doc.fontSize(14).fillColor(white).text('Kontaktujte nas', 65, y + 15);
    doc.fontSize(11).fillColor('#9CA3AF').text('Web: weblyx.cz   |   Email: info@weblyx.cz', 65, y + 40);

    // =============================================
    // Footer on all pages
    // =============================================
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      // Subtle footer
      doc.fontSize(7).fillColor('#9CA3AF').text(
        `weblyx.cz  |  Nabidka pro ${firmName}  |  ${i + 1} / ${pageCount}`,
        0, H - 20, { width: W, align: 'center' }
      );
    }

    doc.end();

    stream.on('finish', () => resolve(pdfPath));
    stream.on('error', reject);
  });
}

export function getProposalPdfPath(contactId: number): string | null {
  const pdfPath = path.join(MOCKUPS_DIR, `${contactId}_nabidka.pdf`);
  return fs.existsSync(pdfPath) ? pdfPath : null;
}
