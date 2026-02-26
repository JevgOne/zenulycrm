import { Router, Request, Response } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import db from '../db/connection';

const router = Router();
const upload = multer({ dest: '/tmp/lead-crm-uploads/' });

// Active scan jobs
const scanJobs = new Map<string, { status: string; progress: string; result?: any }>();

// POST /api/import/csv - Upload CSV
router.post('/csv', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const csvContent = fs.readFileSync(req.file.path, 'utf-8');
  const { data, errors } = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

  if (errors.length > 0) {
    return res.status(400).json({ error: 'CSV parse errors', details: errors });
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  const insertStmt = db.prepare(`
    INSERT INTO contacts (
      business_name, url, domain, email, phone, contact_name,
      category, city, source,
      score, mobile_friendly, ssl_valid, copyright_year,
      cms, cms_version, load_time, outdated_tech
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'csv_import', ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateStmt = db.prepare(`
    UPDATE contacts SET
      score = ?, mobile_friendly = ?, ssl_valid = ?, copyright_year = ?,
      cms = ?, cms_version = ?, load_time = ?, outdated_tech = ?,
      updated_at = datetime('now')
    WHERE domain = ?
  `);

  const findByDomain = db.prepare('SELECT id FROM contacts WHERE domain = ?');

  const importTransaction = db.transaction(() => {
    for (const row of data as any[]) {
      const domain = row.domain || extractDomain(row.url);
      if (!domain && !row.email) { skipped++; continue; }

      // Parse outdated_tech
      let outdatedTech: string[] = [];
      if (row.outdated_tech) {
        outdatedTech = row.outdated_tech.split(';').map((s: string) => s.trim()).filter(Boolean);
      }

      const existing = domain ? findByDomain.get(domain) : null;

      if (existing) {
        updateStmt.run(
          Number(row.score) || 0,
          row.mobile_friendly === 'True' || row.mobile_friendly === '1' ? 1 : 0,
          row.ssl_valid === 'True' || row.ssl_valid === '1' ? 1 : 0,
          row.copyright_year ? Number(row.copyright_year) : null,
          row.cms || null,
          row.cms_version || null,
          row.load_time ? Number(row.load_time) : null,
          JSON.stringify(outdatedTech),
          domain
        );
        updated++;
      } else {
        insertStmt.run(
          row.business_name || null,
          row.url || null,
          domain || null,
          row.email || null,
          row.phone || null,
          row.contact_name || null,
          row.category || null,
          row.city || null,
          Number(row.score) || 0,
          row.mobile_friendly === 'True' || row.mobile_friendly === '1' ? 1 : 0,
          row.ssl_valid === 'True' || row.ssl_valid === '1' ? 1 : 0,
          row.copyright_year ? Number(row.copyright_year) : null,
          row.cms || null,
          row.cms_version || null,
          row.load_time ? Number(row.load_time) : null,
          JSON.stringify(outdatedTech)
        );
        imported++;
      }
    }
  });

  importTransaction();

  // Cleanup uploaded file
  fs.unlinkSync(req.file.path);

  // Log import activity
  db.prepare(`
    INSERT INTO activities (contact_id, type, title, details)
    SELECT id, 'import', 'Importováno z CSV', ?
    FROM contacts WHERE source = 'csv_import'
    ORDER BY created_at DESC LIMIT ?
  `).run(JSON.stringify({ imported, updated, skipped }), imported);

  res.json({ imported, updated, skipped, total: (data as any[]).length });
});

// POST /api/import/scan - Trigger Python scanner
router.post('/scan', (req: Request, res: Response) => {
  const { category, city, mode = 'google' } = req.body;
  const jobId = Date.now().toString(36);
  const outputPath = `/tmp/lead-crm-scan-${jobId}.csv`;

  const leadFinderPath = process.env.LEAD_FINDER_PATH || path.join(__dirname, '../../../../lead-finder');

  scanJobs.set(jobId, { status: 'running', progress: 'Starting scan...' });

  const args = ['batch_run.py'];
  if (category) { args.push('--category', category); }
  if (city) { args.push('--city', city); }
  args.push('--output', outputPath);

  const proc = spawn('python3', args, { cwd: leadFinderPath });

  let output = '';
  proc.stdout.on('data', (data: Buffer) => {
    output += data.toString();
    const lines = output.split('\n').filter(Boolean);
    const lastLine = lines[lines.length - 1] || '';
    scanJobs.set(jobId, { status: 'running', progress: lastLine });
  });

  proc.stderr.on('data', (data: Buffer) => {
    output += data.toString();
  });

  proc.on('close', (code: number) => {
    if (code === 0 && fs.existsSync(outputPath)) {
      // Auto-import the results
      const csvContent = fs.readFileSync(outputPath, 'utf-8');
      const { data } = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

      let imported = 0;
      const findByDomain = db.prepare('SELECT id FROM contacts WHERE domain = ?');
      const insertStmt = db.prepare(`
        INSERT INTO contacts (
          url, domain, category, city, source,
          score, mobile_friendly, ssl_valid, copyright_year,
          cms, cms_version, load_time, outdated_tech
        ) VALUES (?, ?, ?, ?, 'auto_scan', ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const row of data as any[]) {
        const domain = row.domain || extractDomain(row.url);
        if (!domain) continue;
        if (findByDomain.get(domain)) continue;

        let outdatedTech: string[] = [];
        if (row.outdated_tech) {
          outdatedTech = row.outdated_tech.split(';').map((s: string) => s.trim()).filter(Boolean);
        }

        insertStmt.run(
          row.url, domain, row.category || category, row.city || city,
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

      fs.unlinkSync(outputPath);
      scanJobs.set(jobId, {
        status: 'completed',
        progress: `Done! Imported ${imported} new contacts.`,
        result: { imported, total: (data as any[]).length }
      });
    } else {
      scanJobs.set(jobId, {
        status: 'error',
        progress: `Scan failed with code ${code}`
      });
    }
  });

  res.json({ jobId, status: 'started' });
});

// GET /api/import/scan/:jobId - Check scan status
router.get('/scan/:jobId', (req: Request, res: Response) => {
  const job = scanJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

function extractDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '');
  } catch {
    return null;
  }
}

export default router;
