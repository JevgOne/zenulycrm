/**
 * Import zákazníků z qsport.cz XML exportu do Turso databáze
 * Spuštění: npx tsx packages/server/src/scripts/import-xml.ts [cesta-k-xml]
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { createClient } from '@libsql/client';

const xmlPath = process.argv[2] || path.join(__dirname, '../../../../customers_qsport.xml');

console.log(`XML: ${xmlPath}`);
console.log(`DB: ${process.env.TURSO_DATABASE_URL}`);

if (!fs.existsSync(xmlPath)) {
  console.error('XML soubor nebyl nalezen!');
  process.exit(1);
}

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
// Initialize schema
const schemaPath = path.join(__dirname, '../db/schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
await client.executeMultiple(schema);
console.log('Schema OK');

// Parse XML
function parseCustomers(xml: string): any[] {
  const customers: any[] = [];
  const customerRegex = /<CUSTOMER\s+id="(\d+)">([\s\S]*?)<\/CUSTOMER>/g;
  let match;

  while ((match = customerRegex.exec(xml)) !== null) {
    const id = match[1];
    const block = match[2];
    const getValue = (tag: string, source = block): string => {
      const m = source.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'));
      return m ? m[1].trim() : '';
    };

    const billingBlock = block.match(/<BILLING_ADDRESS>([\s\S]*?)<\/BILLING_ADDRESS>/);
    const billing = billingBlock ? billingBlock[1] : '';
    const accountBlock = block.match(/<ACCOUNT>([\s\S]*?)<\/ACCOUNT>/);
    const account = accountBlock ? accountBlock[1] : '';
    const shippingBlock = block.match(/<SHIPPING_ADDRESS>([\s\S]*?)<\/SHIPPING_ADDRESS>/);
    const shipping = shippingBlock ? shippingBlock[1] : '';

    const fullName = getValue('FULL_NAME', billing);
    const company = getValue('COMPANY', billing);
    const street = getValue('STREET', billing);
    const houseNumber = getValue('HOUSE_NUMBER', billing);
    const city = getValue('CITY', billing);
    const zip = getValue('ZIP', billing);
    const country = getValue('COUNTRY', billing);
    const companyId = getValue('COMPANY_ID', billing);
    const vatId = getValue('VAT_ID', billing);
    const email = getValue('EMAIL', account);
    const phone = getValue('PHONE', account);
    const customerGroup = getValue('CUSTOMER_GROUP');
    const registrationDate = getValue('REGISTRATION_DATE');
    const discountPercent = getValue('DISCOUNT_PERCENT');
    const remark = getValue('REMARK');
    const shipName = shipping ? getValue('FULL_NAME', shipping) : '';
    const shipCity = shipping ? getValue('CITY', shipping) : '';

    customers.push({
      originalId: id,
      contactName: fullName || shipName || '',
      businessName: company || '',
      email: email || '',
      phone: phone || '',
      city: city || shipCity || '',
      street, houseNumber, zip, country, companyId, vatId,
      category: customerGroup || '',
      discountPercent: discountPercent || '0',
      remark: remark || '',
      registrationDate: registrationDate || '',
    });
  }
  return customers;
}

console.log('Nacitam XML...');
const xml = fs.readFileSync(xmlPath, 'utf-8');
const customers = parseCustomers(xml);
console.log(`Nalezeno: ${customers.length} zakazniku`);

// Import in batches of 50
let imported = 0, skipped = 0, duplicates = 0;
const BATCH_SIZE = 50;

for (let i = 0; i < customers.length; i += BATCH_SIZE) {
  const batch = customers.slice(i, i + BATCH_SIZE);
  const stmts: Array<{ sql: string; args: any[] }> = [];

  for (const c of batch) {
    if (!c.email && !c.contactName && !c.businessName) { skipped++; continue; }

    // Build notes
    const noteParts: string[] = [];
    if (c.street && c.houseNumber) noteParts.push(`Adresa: ${c.street} ${c.houseNumber}, ${c.zip} ${c.city}`);
    else if (c.street) noteParts.push(`Adresa: ${c.street}, ${c.zip} ${c.city}`);
    if (c.country) noteParts.push(`Zeme: ${c.country}`);
    if (c.companyId) noteParts.push(`ICO: ${c.companyId}`);
    if (c.vatId) noteParts.push(`DIC: ${c.vatId}`);
    if (c.discountPercent && c.discountPercent !== '0') noteParts.push(`Sleva: ${c.discountPercent}%`);
    if (c.remark) noteParts.push(`Poznamka: ${c.remark}`);
    const notes = noteParts.length > 0 ? noteParts.join('\n') : null;
    const createdAt = c.registrationDate || new Date().toISOString().replace('T', ' ').slice(0, 19);

    stmts.push({
      sql: `INSERT INTO contacts (business_name, email, phone, contact_name, category, city, source, notes, stage, priority, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'xml_import', ?, 'new', 'medium', ?, ?)`,
      args: [
        c.businessName || null, c.email || null, c.phone || null,
        c.contactName || null, c.category || null, c.city || null,
        notes, createdAt, createdAt,
      ],
    });
    imported++;
  }

  if (stmts.length > 0) {
    await client.batch(stmts, 'write');
  }

  if ((i + BATCH_SIZE) % 1000 < BATCH_SIZE) {
    console.log(`  ... ${Math.min(i + BATCH_SIZE, customers.length)} / ${customers.length}`);
  }
}

console.log(`\nImport dokoncen!`);
console.log(`  Importovano: ${imported}`);
console.log(`  Preskoceno: ${skipped}`);
console.log(`  Celkem v XML: ${customers.length}`);

const countRow = await client.execute('SELECT COUNT(*) as c FROM contacts');
console.log(`  Celkem v DB: ${countRow.rows[0].c}`);

process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
