/**
 * Import zákazníků z qsport.cz XML exportu do Weblyx CRM databáze
 * Spuštění: npx tsx packages/server/src/scripts/import-xml.ts [cesta-k-xml]
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

const xmlPath = process.argv[2] || path.join(__dirname, '../../../../customers_qsport.xml');
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../../data/lead-crm.db');

// Resolve relative DB path from project root
const resolvedDbPath = path.isAbsolute(dbPath)
  ? dbPath
  : path.resolve(path.join(__dirname, '../../../..'), dbPath);

console.log(`📂 XML soubor: ${xmlPath}`);
console.log(`💾 Databáze: ${resolvedDbPath}`);

if (!fs.existsSync(xmlPath)) {
  console.error('❌ XML soubor nebyl nalezen!');
  process.exit(1);
}

// Initialize database
const db = new Database(resolvedDbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Ensure schema exists
const schemaPath = path.join(__dirname, '../db/schema.sql');
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  console.log('✅ Schéma databáze připraveno');
}

// Simple XML parser for the customer structure
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

    // Billing address block
    const billingBlock = block.match(/<BILLING_ADDRESS>([\s\S]*?)<\/BILLING_ADDRESS>/);
    const billing = billingBlock ? billingBlock[1] : '';

    // Account block (first account)
    const accountBlock = block.match(/<ACCOUNT>([\s\S]*?)<\/ACCOUNT>/);
    const account = accountBlock ? accountBlock[1] : '';

    // Shipping address block (first)
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

    // Shipping address
    const shipName = shipping ? getValue('FULL_NAME', shipping) : '';
    const shipStreet = shipping ? getValue('STREET', shipping) : '';
    const shipHouseNumber = shipping ? getValue('HOUSE_NUMBER', shipping) : '';
    const shipCity = shipping ? getValue('CITY', shipping) : '';
    const shipZip = shipping ? getValue('ZIP', shipping) : '';
    const shipCountry = shipping ? getValue('COUNTRY', shipping) : '';

    customers.push({
      originalId: id,
      contactName: fullName || shipName || '',
      businessName: company || '',
      email: email || '',
      phone: phone || '',
      city: city || shipCity || '',
      street: street || shipStreet || '',
      houseNumber: houseNumber || shipHouseNumber || '',
      zip: zip || shipZip || '',
      country: country || shipCountry || '',
      category: customerGroup || '',
      companyId: companyId || '',
      vatId: vatId || '',
      discountPercent: discountPercent || '0',
      remark: remark || '',
      registrationDate: registrationDate || '',
    });
  }

  return customers;
}

// Read and parse XML
console.log('📖 Načítám XML soubor...');
const xml = fs.readFileSync(xmlPath, 'utf-8');
console.log(`📄 Velikost: ${(xml.length / 1024 / 1024).toFixed(1)} MB`);

const customers = parseCustomers(xml);
console.log(`👥 Nalezeno zákazníků: ${customers.length}`);

// Prepare statements
const findByEmail = db.prepare('SELECT id FROM contacts WHERE email = ?');
const insertStmt = db.prepare(`
  INSERT INTO contacts (
    business_name, email, phone, contact_name,
    category, city, source, notes, stage, priority,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, 'xml_import', ?, 'new', 'medium', ?, ?)
`);

const insertActivity = db.prepare(`
  INSERT INTO activities (contact_id, type, title, details, created_at)
  VALUES (?, 'import', 'Import z qsport.cz XML', ?, ?)
`);

// Import
let imported = 0;
let skipped = 0;
let duplicates = 0;

const importTransaction = db.transaction(() => {
  for (const c of customers) {
    // Skip if no email and no name
    if (!c.email && !c.contactName && !c.businessName) {
      skipped++;
      continue;
    }

    // Check duplicates by email
    if (c.email) {
      const existing = findByEmail.get(c.email) as any;
      if (existing) {
        duplicates++;
        continue;
      }
    }

    // Build notes with extra info
    const noteParts: string[] = [];
    if (c.street && c.houseNumber) noteParts.push(`Adresa: ${c.street} ${c.houseNumber}, ${c.zip} ${c.city}`);
    else if (c.street) noteParts.push(`Adresa: ${c.street}, ${c.zip} ${c.city}`);
    if (c.country) noteParts.push(`Země: ${c.country}`);
    if (c.companyId) noteParts.push(`IČO: ${c.companyId}`);
    if (c.vatId) noteParts.push(`DIČ: ${c.vatId}`);
    if (c.discountPercent && c.discountPercent !== '0') noteParts.push(`Sleva: ${c.discountPercent}%`);
    if (c.remark) noteParts.push(`Poznámka: ${c.remark}`);
    const notes = noteParts.length > 0 ? noteParts.join('\n') : null;

    const createdAt = c.registrationDate || new Date().toISOString().replace('T', ' ').slice(0, 19);

    const result = insertStmt.run(
      c.businessName || null,
      c.email || null,
      c.phone || null,
      c.contactName || null,
      c.category || null,
      c.city || null,
      notes,
      createdAt,
      createdAt
    );

    // Log activity
    insertActivity.run(
      result.lastInsertRowid,
      JSON.stringify({ source: 'qsport.cz', originalId: c.originalId }),
      createdAt
    );

    imported++;
  }
});

console.log('🚀 Importuji do databáze...');
importTransaction();

console.log('\n✅ Import dokončen!');
console.log(`   📥 Importováno: ${imported}`);
console.log(`   🔄 Duplikáty: ${duplicates}`);
console.log(`   ⏭️  Přeskočeno: ${skipped}`);
console.log(`   📊 Celkem v XML: ${customers.length}`);

// Show stats
const total = (db.prepare('SELECT COUNT(*) as count FROM contacts').get() as any).count;
console.log(`\n💾 Celkem kontaktů v databázi: ${total}`);

db.close();
