import { Link } from 'react-router-dom';
import {
  Users, BarChart3, Mail, Zap, Shield, Globe,
  ArrowRight, CheckCircle2, Star, ChevronRight
} from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Správa kontaktů',
    desc: 'Přehledná databáze všech vašich zákazníků a leadů na jednom místě.',
    color: 'from-blue-500 to-blue-600',
    bg: 'bg-primary/10',
  },
  {
    icon: BarChart3,
    title: 'Pipeline & Analytics',
    desc: 'Vizuální pipeline pro sledování obchodních příležitostí a konverzí.',
    color: 'from-violet-500 to-violet-600',
    bg: 'bg-primary/10',
  },
  {
    icon: Mail,
    title: 'Email kampaně',
    desc: 'Hromadné emaily, šablony a automatické follow-up sekvence.',
    color: 'from-emerald-500 to-emerald-600',
    bg: 'bg-teal/10',
  },
  {
    icon: Zap,
    title: 'Automatizace',
    desc: 'Automatické sekvence, připomínky a chytré notifikace.',
    color: 'from-amber-500 to-amber-600',
    bg: 'bg-accent/10',
  },
];

const stats = [
  { value: '15 000+', label: 'Kontaktů' },
  { value: '24/7', label: 'Dostupnost' },
  { value: '100%', label: 'Česky' },
  { value: '0 Kč', label: 'Za setup' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface animate-page">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-border-light">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">Z</span>
            </div>
            <span className="font-bold text-lg text-text">
              Zenuly<span className="text-primary">.cz</span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm text-text hover:text-text transition-colors hidden sm:block">Funkce</a>
            <a href="#about" className="text-sm text-text hover:text-text transition-colors hidden sm:block">O nás</a>
            <Link
              to="/login"
              className="px-5 py-2 bg-text text-surface text-sm font-medium rounded-lg hover:bg-text/90 transition-colors flex items-center gap-1.5"
            >
              Přihlásit se
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-full mb-6 border border-primary/20">
              <Star size={12} className="fill-primary" />
              CRM systém nové generace
            </div>
            <h1 className="text-5xl sm:text-6xl font-extrabold text-text leading-[1.1] tracking-tight">
              Vaše podnikání
              <br />
              <span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
                pod kontrolou.
              </span>
            </h1>
            <p className="text-lg text-text-muted mt-6 max-w-xl leading-relaxed">
              Zenuly CRM vám pomůže spravovat kontakty, sledovat obchodní pipeline
              a automatizovat komunikaci se zákazníky. Vše na jednom místě, vše česky.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                to="/login"
                className="px-6 py-3 bg-gradient-to-r from-primary to-primary/80 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-primary/25 transition-all flex items-center gap-2"
              >
                Vstoupit do CRM
                <ArrowRight size={16} />
              </Link>
              <a
                href="#features"
                className="px-6 py-3 bg-border text-text font-medium rounded-xl hover:bg-surface2 transition-colors flex items-center gap-2"
              >
                Zjistit více
                <ChevronRight size={16} />
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-16">
            {stats.map(s => (
              <div key={s.label} className="bg-surface2 rounded-2xl p-5 text-center border border-border-light">
                <div className="text-2xl font-extrabold text-text">{s.value}</div>
                <div className="text-xs text-text-muted mt-1 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 bg-surface2/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-text">Vše co potřebujete</h2>
            <p className="text-text-muted mt-3 max-w-lg mx-auto">
              Kompletní CRM řešení pro malé a střední firmy. Bez zbytečných komplikací.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {features.map(f => (
              <div key={f.title} className="bg-surface2 rounded-2xl p-6 border border-border-light hover:border-primary/30 transition-all group">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <f.icon size={22} className="text-white" />
                </div>
                <h3 className="font-bold text-text text-lg">{f.title}</h3>
                <p className="text-sm text-text-muted mt-2 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About / CTA */}
      <section id="about" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-10 sm:p-14 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(76,110,245,0.15),transparent_60%)]" />
            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
                Připraveni začít?
              </h2>
              <p className="text-text-dim max-w-md mx-auto mb-8">
                Přihlaste se do administrace a začněte spravovat své kontakty ještě dnes.
              </p>
              <div className="flex flex-wrap justify-center gap-6 mb-10">
                {[
                  'Správa kontaktů',
                  'Email kampaně',
                  'Pipeline view',
                  'Import dat',
                  'Automatické sekvence',
                  'Kompletně česky',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2 text-sm text-gray-300">
                    <CheckCircle2 size={14} className="text-teal" />
                    {item}
                  </div>
                ))}
              </div>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-gray-900 font-semibold rounded-xl hover:shadow-xl transition-all"
              >
                Přihlásit se do CRM
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-light py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">Z</span>
            </div>
            <span className="text-sm font-semibold text-text">Zenuly.cz</span>
          </div>
          <p className="text-xs text-text-dim">
            &copy; {new Date().getFullYear()} Zenuly CRM. Všechna práva vyhrazena.
          </p>
        </div>
      </footer>
    </div>
  );
}
