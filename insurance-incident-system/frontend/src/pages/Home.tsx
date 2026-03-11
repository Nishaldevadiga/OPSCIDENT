import { Link } from 'react-router-dom';

const features = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'AI-Powered Processing',
    description: 'Your claim and photos are analyzed instantly to assess damage and speed up your resolution—no waiting on manual reviews.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Instant Decisions',
    description: 'Eligible claims get auto-approved. Only complex cases need human review, so you get faster payouts.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Accurate Verification',
    description: 'We verify your claim details and photos to ensure consistent, fair processing and a faster outcome for you.',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.12),transparent)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary-500/30 to-transparent" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#33415512_1px,transparent_1px),linear-gradient(to_bottom,#33415512_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <Link to="/" className="text-xl font-bold tracking-tight text-slate-50 font-heading">
          Opscident
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="btn-primary text-sm font-medium px-5 py-2 rounded-lg"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-32">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-400 text-xs font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
            </span>
            AI-powered incident management
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-50 leading-[1.1] tracking-tight font-heading">
            Turn claims into
            <span className="text-primary-400"> outcomes</span>
          </h1>
          <p className="mt-6 text-lg text-slate-400 leading-relaxed">
            Submit insurance claims, get AI analysis in seconds, and track every step. 
            Faster decisions, less paperwork, full transparency.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto btn-primary px-8 py-3.5 text-base font-semibold rounded-xl shadow-glow"
            >
              Start a claim
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto btn-secondary px-8 py-3.5 text-base font-medium rounded-xl"
            >
              Sign in to dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-32">
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <div
              key={i}
              className="group relative p-8 rounded-2xl bg-slate-900/40 border border-slate-800/60 hover:border-primary-500/30 hover:bg-slate-900/60 transition-all duration-300"
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary-500/10 text-primary-400 group-hover:bg-primary-500/20 transition-colors">
                {f.icon}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-slate-100 font-heading">
                {f.title}
              </h3>
              <p className="mt-2 text-slate-400 text-sm leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24">
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-12 text-center">
          <h2 className="text-2xl font-bold text-slate-50 font-heading">
            Ready to streamline your claims?
          </h2>
          <p className="mt-2 text-slate-400">
            Create an account and submit your first claim in minutes.
          </p>
          <Link
            to="/register"
            className="inline-flex mt-6 btn-primary px-8 py-3 text-base font-semibold rounded-xl"
          >
            Create free account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-slate-500 text-sm">© Opscident. All rights reserved.</span>
          <div className="flex gap-6">
            <Link to="/login" className="text-sm text-slate-500 hover:text-slate-400 transition-colors">Sign in</Link>
            <Link to="/register" className="text-sm text-slate-500 hover:text-slate-400 transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
