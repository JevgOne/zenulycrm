import { useState, useRef, useEffect } from 'react';
import { post } from '../api/client';
import { MessageCircle, X, Send, Loader2, Bot, User, Wrench, Minimize2 } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: Array<{ tool: string; result: string }>;
}

const TOOL_LABELS: Record<string, string> = {
  get_dashboard_stats: 'Statistiky',
  search_contacts: 'Hledání kontaktů',
  get_contact_detail: 'Detail kontaktu',
  generate_ai_email: 'Generování emailu',
  generate_mockup: 'Generování mockupu',
  update_contact_stage: 'Změna pipeline',
  add_note: 'Přidání poznámky',
  get_best_leads: 'Nejlepší leady',
  get_campaigns: 'Kampaně',
};

const QUICK_ACTIONS = [
  'Ukaž nejlepší leady',
  'Jaké mám statistiky?',
  'Kolik je nových kontaktů?',
];

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open && !minimized) {
      inputRef.current?.focus();
    }
  }, [open, minimized]);

  // Keyboard shortcut: Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
        setMinimized(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response: ChatMessage = await post('/ai/chat', {
        message: msg,
        history: messages,
      });
      setMessages([...newMessages, response]);
    } catch (err: any) {
      setMessages([...newMessages, {
        role: 'assistant',
        content: `Chyba: ${err.message}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setMinimized(false); }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/30 hover:scale-105 transition-transform z-50"
        title="AI Asistent (Cmd+K)"
      >
        <MessageCircle size={24} />
      </button>
    );
  }

  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-6 right-6 bg-surface2 border border-border-light rounded-2xl px-4 py-3 flex items-center gap-2 shadow-lg z-50 hover:bg-surface transition-colors"
      >
        <Bot size={18} className="text-primary-light" />
        <span className="text-sm text-text font-medium">AI Asistent</span>
        {loading && <Loader2 size={14} className="animate-spin text-primary-light" />}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[420px] h-[600px] bg-surface2 rounded-2xl border border-border-light shadow-2xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light bg-surface2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Bot size={18} className="text-primary-light" />
          </div>
          <div>
            <div className="text-sm font-semibold text-text">AI Asistent</div>
            <div className="text-[10px] text-text-dim">Claude Sonnet - Zenuly CRM</div>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setMinimized(true)} className="p-1.5 text-text-dim hover:text-text rounded-lg hover:bg-surface">
            <Minimize2 size={14} />
          </button>
          <button onClick={() => setOpen(false)} className="p-1.5 text-text-dim hover:text-text rounded-lg hover:bg-surface">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot size={40} className="mx-auto text-primary/30 mb-3" />
            <p className="text-sm text-text-muted mb-1">Ahoj! Jsem tvůj AI asistent.</p>
            <p className="text-xs text-text-dim mb-4">Zeptej se mě na cokoliv o kontaktech, kampaních nebo mi řekni co mám udělat.</p>
            <div className="space-y-2">
              {QUICK_ACTIONS.map(action => (
                <button
                  key={action}
                  onClick={() => sendMessage(action)}
                  className="block w-full text-left px-3 py-2 text-sm bg-surface rounded-lg border border-border-light text-text-muted hover:text-text hover:border-primary/30 transition-colors"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={14} className="text-primary-light" />
              </div>
            )}
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
              <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-md'
                  : 'bg-surface border border-border-light text-text rounded-bl-md'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>

              {/* Tool actions indicator */}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {msg.actions.map((a, j) => (
                    <span key={j} className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary-light px-2 py-0.5 rounded-full">
                      <Wrench size={9} />
                      {TOOL_LABELS[a.tool] || a.tool}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center shrink-0 mt-0.5 border border-border-light">
                <User size={14} className="text-text-dim" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Bot size={14} className="text-primary-light" />
            </div>
            <div className="bg-surface border border-border-light rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <Loader2 size={14} className="animate-spin" />
                Přemýšlím...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border-light">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Napiš zprávu..."
            className="flex-1 bg-surface border border-border-light rounded-xl px-3.5 py-2.5 text-sm text-text placeholder-text-dim focus:outline-none focus:border-primary/50 transition-colors"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="text-[10px] text-text-dim mt-1.5 text-center">
          Cmd+K pro otevření/zavření
        </div>
      </div>
    </div>
  );
}
