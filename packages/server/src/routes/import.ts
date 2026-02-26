import { Router, Request, Response } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import db from '../db/connection';

const router = Router();
const upload = multer({ dest: '/tmp/lead-crm-uploads/' });

const scanJobs = new Map<string, { status: string; progress: string; result?: any }>();

router.post('/csv', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const csvContent = fs.readFileSync(req.file.path, 'utf-8');
  const { data, errors } = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

  if (errors.length > 0) {
    return res.status(400).json({ error: 'CSV parse errors', details: errors });
  }

  let imported = 0, updated = 0, skipped = 0;

  for (const row of data as any[]) {
    const domain = row.domain || extractDomain(row.url);
    if (!domain && !row.email) { skipped++; continue; }

    let outdatedTech: string[] = [];
    if (row.outdated_tech) {
      outdatedTech = row.outdated_tech.split(';').map((s: string) => s.trim()).filter(Boolean);
    }

    const existing = domain ? await db.get('SELECT id FROM contacts WHERE domain = ?', domain) : null;

    if (existing) {
      await db.run(`
        UPDATE contacts SET score = ?, mobile_friendly = ?, ssl_valid = ?, copyright_year = ?,
        cms = ?, cms_version = ?, load_time = ?, outdated_tech = ?, updated_at = datetime('now') WHERE domain = ?
      `,
        Number(row.score) || 0,
        row.mobile_friendly === 'True' || row.mobile_friendly === '1' ? 1 : 0,
        row.ssl_valid === 'True' || row.ssl_valid === '1' ? 1 : 0,
        row.copyright_year ? Number(row.copyright_year) : null,
        row.cms || null, row.cms_version || null,
        row.load_time ? Number(row.load_time) : null,
        JSON.stringify(outdatedTech), domain
      );
      updated++;
    } else {
      await db.run(`
        INSERT INTO contacts (business_name, url, domain, email, phone, contact_name,
          category, city, source, score, mobile_friendly, ssl_valid, copyright_year,
          cms, cms_version, load_time, outdated_tech
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'csv_import', ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        row.business_name || null, row.url || null, domain || null,
        row.email || null, row.phone || null, row.contact_name || null,
        row.category || null, row.city || null,
        Number(row.score) || 0,
        row.mobile_friendly === 'True' || row.mobile_friendly === '1' ? 1 : 0,
        row.ssl_valid === 'True' || row.ssl_valid === '1' ? 1 : 0,
        row.copyright_year ? Number(row.copyright_year) : null,
        row.cms || null, row.cms_version || null,
        row.load_time ? Number(row.load_time) : null,
        JSON.stringify(outdatedTech)
      );
      imported++;
    }
  }

  fs.unlinkSync(req.file.path);
  res.json({ imported, updated, skipped, total: (data as any[]).length });
});

router.post('/scan', (req: Request, res: Response) => {
  const { category, city, mode = 'google' } = req.body;
  const jobId = Date.now().toString(36);
  const outputPath = `/tmp/lead-crm-scan-${jobId}.csv`;
  const leadFinderPath = process.env.LEAD_FINDER_PATH || path.join(__dirname, '../../../../lead-finder');

  scanJobs.set(jobId, { status: 'running', progress: 'Starting scan...' });

  const args = ['batch_run.py'];
  if (category) args.push('--category', category);
  if (city) args.push('--city', city);
  args.push('--output', outputPath);

  const proc = spawn('python3', args, { cwd: leadFinderPath });
  let output = '';

  proc.stdout.on('data', (data: Buffer) => {
    output += data.toString();
    const lines = output.split('\n').filter(Boolean);
    scanJobs.set(jobId, { status: 'running', progress: lines[lines.length - 1] || '' });
  });

  proc.stderr.on('data', (data: Buffer) => { output += data.toString(); });

  proc.on('close', async (code: number) => {
    if (code === 0 && fs.existsSync(outputPath)) {
      const csvContent = fs.readFileSync(outputPath, 'utf-8');
      const { data } = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

      let imported = 0;
      for (const row of data as any[]) {
        const domain = (row as any).domain || extractDomain((row as any).url);
        if (!domain) continue;
        const exists = await db.get('SELECT id FROM contacts WHERE domain = ?', domain);
        if (exists) continue;

        let outdatedTech: string[] = [];
        if ((row as any).outdated_tech) {
          outdatedTech = (row as any).outdated_tech.split(';').map((s: string) => s.trim()).filter(Boolean);
        }

        await db.run(`
          INSERT INTO contacts (url, domain, category, city, source,
            score, mobile_friendly, ssl_valid, copyright_year,
            cms, cms_version, load_time, outdated_tech
          ) VALUES (?, ?, ?, ?, 'auto_scan', ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          (row as any).url, domain, (row as any).category || category, (row as any).city || city,
          Number((row as any).score) || 0,
          (row as any).mobile_friendly === 'True' || (row as any).mobile_friendly === '1' ? 1 : 0,
          (row as any).ssl_valid === 'True' || (row as any).ssl_valid === '1' ? 1 : 0,
          (row as any).copyright_year ? Number((row as any).copyright_year) : null,
          (row as any).cms || null, (row as any).cms_version || null,
          (row as any).load_time ? Number((row as any).load_time) : null,
          JSON.stringify(outdatedTech)
        );
        imported++;
      }

      fs.unlinkSync(outputPath);
      scanJobs.set(jobId, { status: 'completed', progress: `Done! Imported ${imported} new contacts.`, result: { imported, total: (data as any[]).length } });
    } else {
      scanJobs.set(jobId, { status: 'error', progress: `Scan failed with code ${code}` });
    }
  });

  res.json({ jobId, status: 'started' });
});

router.get('/scan/:jobId', (req: Request, res: Response) => {
  const job = scanJobs.get(req.params.jobId as string);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

function extractDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '');
  } catch { return null; }
}

export default router;
