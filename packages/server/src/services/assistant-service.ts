import Anthropic from '@anthropic-ai/sdk';
import db from '../db/connection';
import { generateEmailForContact } from './ai-service';
import { generateMockup, getMockupPaths } from './mockup-service';

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
  return new Anthropic({ apiKey });
}

const SYSTEM_PROMPT = `Jsi AI asistent pro Zenuly CRM - systém pro správu leadů a oslovování firem se zastaralými weby.

Komunikuješ česky, jsi stručný a profesionální. Pomáháš s:
- Přehledem kontaktů a statistik
- Generováním AI emailů pro kontakty
- Generováním redesign mockupů
- Analýzou kontaktů a doporučeními
- Správou kampaní a pipeline

Když uživatel chce provést akci, použij dostupné nástroje. Vždy odpovídej česky.
Pokud se uživatel zeptá na něco, co nemůžeš udělat, řekni mu to a nabídni alternativu.
Buď proaktivní - pokud vidíš příležitost ke zlepšení, navrhni ji.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_dashboard_stats',
    description: 'Získá přehledové statistiky CRM - počty kontaktů, kampaní, emailů.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'search_contacts',
    description: 'Vyhledá kontakty podle filtrů (obor, město, score, stage).',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: { type: 'string', description: 'Filtrovat podle oboru' },
        city: { type: 'string', description: 'Filtrovat podle města' },
        min_score: { type: 'number', description: 'Minimální score zastaralosti' },
        stage: { type: 'string', description: 'Fáze pipeline (new, contacted, responded, meeting, client, lost)' },
        limit: { type: 'number', description: 'Max počet výsledků (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_contact_detail',
    description: 'Získá detail konkrétního kontaktu včetně analýzy webu a historie aktivit.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_id: { type: 'number', description: 'ID kontaktu' },
      },
      required: ['contact_id'],
    },
  },
  {
    name: 'generate_ai_email',
    description: 'Vygeneruje personalizovaný AI email pro kontakt na základě dat z analýzy webu.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_id: { type: 'number', description: 'ID kontaktu' },
      },
      required: ['contact_id'],
    },
  },
  {
    name: 'generate_mockup',
    description: 'Vygeneruje redesign mockup webu kontaktu (screenshot originálu + AI redesign).',
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_id: { type: 'number', description: 'ID kontaktu' },
      },
      required: ['contact_id'],
    },
  },
  {
    name: 'update_contact_stage',
    description: 'Přesune kontakt do jiné fáze pipeline.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_id: { type: 'number', description: 'ID kontaktu' },
        stage: { type: 'string', enum: ['new', 'contacted', 'responded', 'meeting', 'client', 'lost'], description: 'Nová fáze' },
      },
      required: ['contact_id', 'stage'],
    },
  },
  {
    name: 'add_note',
    description: 'Přidá poznámku ke kontaktu.',
    input_schema: {
      type: 'object' as const,
      properties: {
        contact_id: { type: 'number', description: 'ID kontaktu' },
        text: { type: 'string', description: 'Text poznámky' },
      },
      required: ['contact_id', 'text'],
    },
  },
  {
    name: 'get_best_leads',
    description: 'Najde nejlepší leady podle score - kontakty s nejvyšší prioritou pro oslovení.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Počet výsledků (default 5)' },
      },
      required: [],
    },
  },
  {
    name: 'get_campaigns',
    description: 'Získá přehled kampaní a jejich statistiky.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

async function executeTool(name: string, input: any): Promise<string> {
  switch (name) {
    case 'get_dashboard_stats': {
      const stats = await db.get(`
        SELECT
          (SELECT COUNT(*) FROM contacts) as total_contacts,
          (SELECT COUNT(*) FROM contacts WHERE stage = 'new') as new_contacts,
          (SELECT COUNT(*) FROM contacts WHERE stage = 'contacted') as contacted,
          (SELECT COUNT(*) FROM contacts WHERE stage = 'responded') as responded,
          (SELECT COUNT(*) FROM contacts WHERE stage = 'client') as clients,
          (SELECT COUNT(*) FROM contacts WHERE score >= 50) as high_score,
          (SELECT COUNT(*) FROM campaigns) as total_campaigns,
          (SELECT COUNT(*) FROM campaigns WHERE status = 'running') as running_campaigns,
          (SELECT COUNT(*) FROM sent_emails) as total_emails,
          (SELECT COUNT(*) FROM sent_emails WHERE status = 'opened') as opened_emails,
          (SELECT COUNT(*) FROM sent_emails WHERE status = 'clicked') as clicked_emails,
          (SELECT AVG(score) FROM contacts WHERE score > 0) as avg_score
      `);
      return JSON.stringify(stats);
    }

    case 'search_contacts': {
      let query = 'SELECT id, business_name, domain, email, city, category, score, stage, priority FROM contacts WHERE 1=1';
      const params: any[] = [];

      if (input.category) { query += ' AND category LIKE ?'; params.push(`%${input.category}%`); }
      if (input.city) { query += ' AND city LIKE ?'; params.push(`%${input.city}%`); }
      if (input.min_score) { query += ' AND score >= ?'; params.push(input.min_score); }
      if (input.stage) { query += ' AND stage = ?'; params.push(input.stage); }

      query += ' ORDER BY score DESC LIMIT ?';
      params.push(input.limit || 10);

      const contacts = await db.all(query, ...params);
      return JSON.stringify(contacts);
    }

    case 'get_contact_detail': {
      const contact = await db.get('SELECT * FROM contacts WHERE id = ?', input.contact_id);
      if (!contact) return JSON.stringify({ error: 'Kontakt nenalezen' });

      const activities = await db.all(
        'SELECT * FROM activities WHERE contact_id = ? ORDER BY created_at DESC LIMIT 10',
        input.contact_id
      );
      const mockup = getMockupPaths(input.contact_id);

      return JSON.stringify({
        ...contact,
        activities,
        mockup_exists: mockup.mockupExists,
      });
    }

    case 'generate_ai_email': {
      const result = await generateEmailForContact(input.contact_id);
      return JSON.stringify(result);
    }

    case 'generate_mockup': {
      await generateMockup(input.contact_id);
      return JSON.stringify({ success: true, message: 'Mockup vygenerován' });
    }

    case 'update_contact_stage': {
      await db.run('UPDATE contacts SET stage = ?, updated_at = datetime(\'now\') WHERE id = ?', input.stage, input.contact_id);
      await db.run(
        "INSERT INTO activities (contact_id, type, title) VALUES (?, 'stage_change', ?)",
        input.contact_id, `Pipeline: ${input.stage}`
      );
      return JSON.stringify({ success: true });
    }

    case 'add_note': {
      await db.run(
        "INSERT INTO activities (contact_id, type, title, details) VALUES (?, 'note', 'Poznámka (AI asistent)', ?)",
        input.contact_id, input.text
      );
      return JSON.stringify({ success: true });
    }

    case 'get_best_leads': {
      const leads = await db.all(
        `SELECT id, business_name, domain, email, city, category, score, stage, outdated_tech
         FROM contacts WHERE stage = 'new' AND score > 0 ORDER BY score DESC LIMIT ?`,
        input.limit || 5
      );
      return JSON.stringify(leads);
    }

    case 'get_campaigns': {
      const campaigns = await db.all(`
        SELECT c.*, t.name as template_name
        FROM campaigns c LEFT JOIN email_templates t ON c.template_id = t.id
        ORDER BY c.created_at DESC LIMIT 10
      `);
      return JSON.stringify(campaigns);
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: Array<{ tool: string; result: string }>;
}

export async function chat(
  message: string,
  history: ChatMessage[]
): Promise<ChatMessage> {
  const client = getClient();

  // Convert history to Claude message format
  const messages: Anthropic.MessageParam[] = history.map(m => ({
    role: m.role,
    content: m.content,
  }));

  messages.push({ role: 'user', content: message });

  const actions: Array<{ tool: string; result: string }> = [];
  let finalText = '';

  // Agentic loop - keep processing until no more tool calls
  let currentMessages = [...messages];

  for (let i = 0; i < 5; i++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: currentMessages,
    });

    // Collect text parts
    const textParts = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text);

    if (textParts.length > 0) {
      finalText += textParts.join('');
    }

    // Check for tool use
    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );

    if (toolUses.length === 0) {
      break; // No more tools, done
    }

    // Execute tools and build tool results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUses) {
      let result: string;
      try {
        result = await executeTool(toolUse.name, toolUse.input);
      } catch (err: any) {
        result = JSON.stringify({ error: err.message });
      }
      actions.push({ tool: toolUse.name, result });
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    // Add assistant response and tool results for next iteration
    currentMessages.push({ role: 'assistant', content: response.content });
    currentMessages.push({ role: 'user', content: toolResults });

    // If stop reason is end_turn, we're done after processing
    if (response.stop_reason === 'end_turn') {
      break;
    }
  }

  return {
    role: 'assistant',
    content: finalText,
    actions: actions.length > 0 ? actions : undefined,
  };
}
