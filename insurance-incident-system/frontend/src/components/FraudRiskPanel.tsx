import type { AIAnalysis, Ticket, Document } from '../types';
import {
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  ShieldCheckIcon,
  PhotoIcon,
  DocumentTextIcon,
  FilmIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageAnalysisData {
  damage_description?: string;
  damage_severity?: number;
  damage_areas?: string[] | string;
  estimated_repair_type?: string;
  fraud_indicators?: string[];
  matches_claim_description?: boolean | string;
  consistency_notes?: string;
  confidence?: number;
}

interface VideoAnalysisData {
  transcript?: string;
  frames_analyzed?: number;
  max_damage_severity?: number;
  all_fraud_indicators?: string[];
  matches_claim_description?: boolean | string;
  frame_analyses?: ImageAnalysisData[];
}

interface PdfAnalysisData {
  incident_summary?: string;
  key_facts?: string[];
  parties_involved?: string[];
  location_mentioned?: string;
  date_mentioned?: string;
  error?: string;
}

interface Props {
  analysis: AIAnalysis;
  ticket: Ticket;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function doesMatch(val: boolean | string | undefined): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === 'boolean') return val;
  return String(val).toLowerCase() !== 'false';
}

/** Human-readable label + severity for a raw fraud indicator string */
function interpretIndicator(raw: string): {
  label: string;
  detail: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
} {
  const s = raw.toLowerCase();

  if (s.includes('stock photo')) {
    return { label: 'Stock Photo Detected', detail: 'Image appears to be sourced from a stock photo library, not an original scene photo.', severity: 'critical' };
  }
  if (s.includes('manipulat') || s.includes('edit') || s.includes('photoshop')) {
    return { label: 'Image Manipulation', detail: 'Signs of digital editing or post-processing detected in the submitted image.', severity: 'critical' };
  }
  if (s.includes('mismatch') || s.includes('does not match') || s.includes("doesn't match")) {
    return { label: 'Claim–Image Mismatch', detail: 'The damage shown in images does not correspond to the described incident.', severity: 'critical' };
  }
  if (s.includes('bike') || s.includes('vehicle type') || s.includes('car') && s.includes('motorcycle')) {
    return { label: 'Vehicle Type Mismatch', detail: 'The type of vehicle in the images conflicts with what was described in the claim.', severity: 'critical' };
  }
  if (s.includes('inconsisten')) {
    return { label: 'Inconsistent Evidence', detail: 'Internal inconsistencies detected between submitted documents and images.', severity: 'high' };
  }
  if (s.includes('lighting') || s.includes('shadow')) {
    return { label: 'Suspicious Lighting', detail: 'Unusual lighting or shadows suggest the image may not depict a real incident scene.', severity: 'medium' };
  }
  if (s.includes('unreadable') || s.includes('unsupported') || s.includes('unable_to_parse')) {
    return { label: 'Unreadable Evidence', detail: 'Submitted image could not be properly analyzed — may indicate an attempt to obscure damage.', severity: 'low' };
  }
  if (s.includes('duplicate') || s.includes('reuse')) {
    return { label: 'Duplicate Image', detail: 'Image may have been used in a previous or concurrent claim.', severity: 'critical' };
  }
  if (s.includes('metadata') || s.includes('exif')) {
    return { label: 'Metadata Anomaly', detail: 'Image metadata (date/location) conflicts with the claim details.', severity: 'high' };
  }
  if (s.includes('missing') || s.includes('no damage')) {
    return { label: 'No Visible Damage', detail: 'Images do not show damage consistent with the claimed incident.', severity: 'high' };
  }
  // Generic fallback
  return {
    label: raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    detail: 'Suspicious element identified during AI document analysis.',
    severity: 'medium',
  };
}

const severityConfig = {
  critical: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-300', badge: 'bg-rose-500/20 text-rose-400', dot: 'bg-rose-500' },
  high:     { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-300', badge: 'bg-orange-500/20 text-orange-400', dot: 'bg-orange-500' },
  medium:   { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', badge: 'bg-amber-500/20 text-amber-400', dot: 'bg-amber-500' },
  low:      { bg: 'bg-slate-700/40', border: 'border-slate-600', text: 'text-slate-300', badge: 'bg-slate-700 text-slate-400', dot: 'bg-slate-500' },
};

function repairLabel(type?: string) {
  switch (type) {
    case 'minor_repair':   return { label: 'Minor Repair', color: 'text-emerald-400' };
    case 'major_repair':   return { label: 'Major Repair', color: 'text-amber-400' };
    case 'replacement':    return { label: 'Full Replacement', color: 'text-rose-400' };
    default:               return { label: 'Unknown', color: 'text-slate-400' };
  }
}

// ─── SVG Speedometer Gauge ────────────────────────────────────────────────────

function FraudGauge({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  const ARC_LENGTH = Math.PI * 75; // = 235.6, semi-circle r=75

  // Colour gradient: green → amber → rose
  const trackColor =
    clamped < 30 ? '#10b981'   // emerald-500
    : clamped < 65 ? '#f59e0b' // amber-500
    : '#f43f5e';               // rose-500

  // Needle angle: π when score=0 (pointing left), 0 when score=100 (pointing right)
  const needleAngle = Math.PI * (1 - clamped / 100);
  const NEEDLE_LEN = 52;
  const CX = 100, CY = 95;
  const tipX = CX + NEEDLE_LEN * Math.cos(needleAngle);
  const tipY = CY - NEEDLE_LEN * Math.sin(needleAngle);

  // Zone tick marks at 30% and 65%
  const tick = (pct: number) => {
    const a = Math.PI * (1 - pct / 100);
    const outer = { x: CX + 78 * Math.cos(a), y: CY - 78 * Math.sin(a) };
    const inner = { x: CX + 68 * Math.cos(a), y: CY - 68 * Math.sin(a) };
    return `M ${inner.x} ${inner.y} L ${outer.x} ${outer.y}`;
  };

  const riskLabel =
    clamped < 30 ? { text: 'LOW RISK', color: '#10b981' }
    : clamped < 65 ? { text: 'MEDIUM RISK', color: '#f59e0b' }
    : { text: 'HIGH RISK', color: '#f43f5e' };

  return (
    <svg viewBox="0 0 200 115" className="w-full max-w-[220px] mx-auto">
      {/* Background arc */}
      <path
        d="M 25 95 A 75 75 0 0 1 175 95"
        fill="none" stroke="#1e293b" strokeWidth="14" strokeLinecap="round"
      />

      {/* Value arc */}
      <path
        d="M 25 95 A 75 75 0 0 1 175 95"
        fill="none"
        stroke={trackColor}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * ARC_LENGTH} ${ARC_LENGTH}`}
        style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.4s ease' }}
      />

      {/* Zone dividers */}
      <path d={tick(30)} stroke="#334155" strokeWidth="2" />
      <path d={tick(65)} stroke="#334155" strokeWidth="2" />

      {/* Zone labels */}
      <text x="22" y="110" fontSize="7" fill="#10b981" textAnchor="middle">LOW</text>
      <text x="100" y="22" fontSize="7" fill="#f59e0b" textAnchor="middle">MED</text>
      <text x="178" y="110" fontSize="7" fill="#f43f5e" textAnchor="middle">HIGH</text>

      {/* Needle */}
      <line x1={CX} y1={CY} x2={tipX} y2={tipY} stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={CX} cy={CY} r="5" fill="#334155" stroke="#f8fafc" strokeWidth="1.5" />

      {/* Score text */}
      <text x={CX} y="82" fontSize="22" fontWeight="700" fill="#f8fafc" textAnchor="middle">{clamped}</text>
      <text x={CX} y="91" fontSize="6.5" fontWeight="600" fill={riskLabel.color} textAnchor="middle" letterSpacing="1">
        {riskLabel.text}
      </text>
    </svg>
  );
}

// ─── Damage Score Bar ─────────────────────────────────────────────────────────

function DamageBar({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-rose-500'
    : score >= 40 ? 'bg-amber-500'
    : 'bg-emerald-500';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">Damage Severity</span>
        <span className="font-semibold text-slate-200">{score}/100</span>
      </div>
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

// ─── Per-image evidence card ─────────────────────────────────────────────────

function ImageEvidenceCard({ data, doc }: { data: ImageAnalysisData; doc?: Document }) {
  const matched = doesMatch(data.matches_claim_description);
  const areas = Array.isArray(data.damage_areas)
    ? data.damage_areas
    : typeof data.damage_areas === 'string'
    ? [data.damage_areas]
    : [];
  const repair = repairLabel(data.estimated_repair_type);
  const severity = data.damage_severity ?? 0;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${matched ? 'border-slate-700 bg-slate-800/30' : 'border-rose-500/30 bg-rose-500/5'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center flex-shrink-0">
            <PhotoIcon className="h-4 w-4 text-sky-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-200 truncate max-w-[120px]">
              {doc?.original_filename ?? 'Image'}
            </p>
            <p className="text-[10px] text-slate-500">Photo Evidence</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${matched ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
          {matched ? <CheckCircleIcon className="h-3 w-3" /> : <XCircleIcon className="h-3 w-3" />}
          {matched ? 'Matches' : 'Mismatch'}
        </span>
      </div>

      {/* Damage severity */}
      <div>
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-slate-500">Damage Score</span>
          <span className="text-slate-300 font-medium">{severity}/100</span>
        </div>
        <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${severity >= 70 ? 'bg-rose-500' : severity >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${severity}%` }}
          />
        </div>
      </div>

      {/* Repair type */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">Repair type</span>
        <span className={`font-medium ${repair.color}`}>{repair.label}</span>
      </div>

      {/* Damage areas */}
      {areas.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-500 mb-1">Affected areas</p>
          <div className="flex flex-wrap gap-1">
            {areas.slice(0, 4).map((area, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] text-slate-300">{String(area)}</span>
            ))}
          </div>
        </div>
      )}

      {/* Fraud indicators from this image */}
      {data.fraud_indicators && data.fraud_indicators.length > 0 && (
        <div className="pt-1 border-t border-slate-700">
          <p className="text-[10px] text-rose-400 font-medium mb-1">Flags from this image:</p>
          <ul className="space-y-0.5">
            {data.fraud_indicators.slice(0, 3).map((ind, i) => (
              <li key={i} className="text-[10px] text-rose-300 flex items-start gap-1">
                <span className="mt-1 w-1 h-1 rounded-full bg-rose-400 flex-shrink-0" />
                {ind.replace(/_/g, ' ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Consistency note on mismatch */}
      {!matched && data.consistency_notes && (
        <div className="pt-1 border-t border-rose-500/20">
          <p className="text-[10px] text-rose-300 italic">"{data.consistency_notes}"</p>
        </div>
      )}
    </div>
  );
}

// ─── Per-PDF evidence card ────────────────────────────────────────────────────

function PdfEvidenceCard({ data, doc }: { data: PdfAnalysisData; doc?: Document }) {
  const facts = data.key_facts ?? [];

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center flex-shrink-0">
          <DocumentTextIcon className="h-4 w-4 text-rose-400" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-200 truncate max-w-[140px]">
            {doc?.original_filename ?? 'Document'}
          </p>
          <p className="text-[10px] text-slate-500">PDF Document</p>
        </div>
      </div>

      {data.error ? (
        <p className="text-xs text-slate-500 italic">{data.error}</p>
      ) : (
        <>
          {data.incident_summary && (
            <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">{data.incident_summary}</p>
          )}
          {facts.length > 0 && (
            <ul className="space-y-1">
              {facts.slice(0, 4).map((fact, i) => (
                <li key={i} className="text-[10px] text-slate-400 flex items-start gap-1.5">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-500 flex-shrink-0" />
                  {fact}
                </li>
              ))}
            </ul>
          )}
          {(data.date_mentioned || data.location_mentioned) && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-700">
              {data.date_mentioned && (
                <span className="text-[10px] text-slate-400">📅 {data.date_mentioned}</span>
              )}
              {data.location_mentioned && (
                <span className="text-[10px] text-slate-400">📍 {data.location_mentioned}</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Per-video evidence card ──────────────────────────────────────────────────

function VideoEvidenceCard({ data, doc }: { data: VideoAnalysisData; doc?: Document }) {
  const matched = doesMatch(data.matches_claim_description);
  const severity = data.max_damage_severity ?? 0;
  const frameCount = data.frames_analyzed ?? 0;
  const fraudFlags = data.all_fraud_indicators ?? [];

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${matched ? 'border-violet-700/50 bg-violet-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
            <FilmIcon className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-200 truncate max-w-[120px]">
              {doc?.original_filename ?? 'Video'}
            </p>
            <p className="text-[10px] text-slate-500">{frameCount} frame{frameCount !== 1 ? 's' : ''} analyzed</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${matched ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
          {matched ? <CheckCircleIcon className="h-3 w-3" /> : <XCircleIcon className="h-3 w-3" />}
          {matched ? 'Matches' : 'Mismatch'}
        </span>
      </div>

      <div>
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-slate-500">Max Frame Damage</span>
          <span className="text-slate-300 font-medium">{severity}/100</span>
        </div>
        <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${severity >= 70 ? 'bg-rose-500' : severity >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${severity}%` }}
          />
        </div>
      </div>

      {data.transcript && (
        <div className="pt-1 border-t border-slate-700">
          <p className="text-[10px] text-slate-500 mb-1">Audio Transcript</p>
          <p className="text-[10px] text-slate-300 italic line-clamp-3">"{data.transcript}"</p>
        </div>
      )}

      {fraudFlags.length > 0 && (
        <div className="pt-1 border-t border-slate-700">
          <p className="text-[10px] text-rose-400 font-medium mb-1">Flags from video:</p>
          <ul className="space-y-0.5">
            {fraudFlags.slice(0, 3).map((f, i) => (
              <li key={i} className="text-[10px] text-rose-300 flex items-start gap-1">
                <span className="mt-1 w-1 h-1 rounded-full bg-rose-400 flex-shrink-0" />
                {f.replace(/_/g, ' ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function FraudRiskPanel({ analysis, ticket }: Props) {
  const rawIndicators = analysis.fraud_indicators ?? [];
  const extracted = (analysis.extracted_data ?? {}) as Record<string, unknown>;

  // Parse per-document analyses
  const imageEntries = Object.entries(extracted)
    .filter(([k]) => k.startsWith('image_'))
    .map(([k, v]) => ({ key: k, docId: parseInt(k.replace('image_', '')), data: v as ImageAnalysisData }));

  const pdfEntries = Object.entries(extracted)
    .filter(([k]) => k.startsWith('pdf_'))
    .map(([k, v]) => ({ key: k, docId: parseInt(k.replace('pdf_', '')), data: v as PdfAnalysisData }));

  const videoEntries = Object.entries(extracted)
    .filter(([k]) => k.startsWith('video_'))
    .map(([k, v]) => ({ key: k, docId: parseInt(k.replace('video_', '')), data: v as VideoAnalysisData }));

  const docMap = new Map<number, Document>(
    (ticket.documents ?? []).map((d) => [d.id, d])
  );

  // Detect mismatch from images and videos
  const hasMismatch =
    imageEntries.some((e) => !doesMatch(e.data.matches_claim_description)) ||
    videoEntries.some((e) => !doesMatch(e.data.matches_claim_description));

  // Compute fraud risk score
  const baseScore =
    rawIndicators.length === 0 ? 5
    : rawIndicators.length === 1 ? 38
    : rawIndicators.length === 2 ? 68
    : Math.min(95, 68 + (rawIndicators.length - 2) * 10);
  const fraudScore = Math.min(100, Math.round(baseScore + (hasMismatch ? 20 : 0)));

  const interpretedIndicators = rawIndicators.map(interpretIndicator);
  const damageScore = analysis.damage_score ?? 0;

  const hasAnyRisk = rawIndicators.length > 0 || hasMismatch;

  return (
    <div className="card overflow-hidden mt-6">
      {/* Header */}
      <div className={`px-6 py-4 border-b border-slate-700 ${hasAnyRisk ? 'bg-gradient-to-r from-rose-500/10 to-orange-500/10' : 'bg-gradient-to-r from-emerald-500/10 to-sky-500/10'}`}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {hasAnyRisk
              ? <ShieldExclamationIcon className="h-5 w-5 text-rose-400" />
              : <ShieldCheckIcon className="h-5 w-5 text-emerald-400" />}
            <h2 className="text-base font-semibold text-slate-100">Fraud Risk Analysis</h2>
            <span className="text-xs text-slate-500 border border-slate-700 bg-slate-800/60 rounded-full px-2 py-0.5">AI-powered</span>
          </div>
          {hasMismatch && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-xs font-medium text-rose-300">
              <XCircleIcon className="h-3.5 w-3.5" />
              Image–Claim Mismatch Detected
            </span>
          )}
        </div>
      </div>

      <div className="p-6 space-y-8">

        {/* ── Row 1: Gauge + Breakdown ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Gauge */}
          <div className="flex flex-col items-center justify-center gap-2">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Fraud Risk Score</p>
            <FraudGauge score={fraudScore} />
            <p className="text-xs text-slate-500 text-center max-w-[180px]">
              Computed from {rawIndicators.length} indicator{rawIndicators.length !== 1 ? 's' : ''}
              {hasMismatch ? ' + image mismatch' : ''}
            </p>
          </div>

          {/* Risk breakdown */}
          <div className="md:col-span-2 space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Risk Breakdown</p>

            {/* Damage score bar */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-3">
              <DamageBar score={damageScore} />
            </div>

            {/* Image/video match status */}
            {(imageEntries.length > 0 || videoEntries.length > 0) && (
              <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${hasMismatch ? 'border-rose-500/30 bg-rose-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}>
                {hasMismatch
                  ? <XCircleIcon className="h-5 w-5 text-rose-400 flex-shrink-0" />
                  : <CheckCircleIcon className="h-5 w-5 text-emerald-400 flex-shrink-0" />}
                <div>
                  <p className={`text-sm font-medium ${hasMismatch ? 'text-rose-300' : 'text-emerald-300'}`}>
                    {hasMismatch ? 'Evidence Does Not Match Claim' : 'Evidence Consistent with Claim'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {hasMismatch
                      ? 'One or more images show damage or object type inconsistent with the claim description.'
                      : 'All submitted images appear consistent with the claimed incident.'}
                  </p>
                </div>
              </div>
            )}

            {/* No risk found */}
            {!hasAnyRisk && imageEntries.length === 0 && videoEntries.length === 0 && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center gap-3">
                <ShieldCheckIcon className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-300">No Fraud Signals Detected</p>
                  <p className="text-xs text-slate-400 mt-0.5">AI found no suspicious indicators in the submitted documents.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Row 2: Fraud Indicator Cards ─────────────────────────────────── */}
        {interpretedIndicators.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ExclamationTriangleIcon className="h-4 w-4 text-rose-400" />
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Fraud Indicators ({interpretedIndicators.length})
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {interpretedIndicators.map((ind, i) => {
                const cfg = severityConfig[ind.severity];
                return (
                  <div key={i} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${cfg.dot}`} />
                        <p className={`text-sm font-medium ${cfg.text}`}>{ind.label}</p>
                      </div>
                      <span className={`flex-shrink-0 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${cfg.badge}`}>
                        {ind.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{ind.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Row 3: Evidence Analysis per-document ────────────────────────── */}
        {(imageEntries.length > 0 || pdfEntries.length > 0 || videoEntries.length > 0) && (
          <div>
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              Evidence Analysis · {imageEntries.length + pdfEntries.length + videoEntries.length} document{imageEntries.length + pdfEntries.length + videoEntries.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {imageEntries.map((e) => (
                <ImageEvidenceCard key={e.key} data={e.data} doc={docMap.get(e.docId)} />
              ))}
              {videoEntries.map((e) => (
                <VideoEvidenceCard key={e.key} data={e.data} doc={docMap.get(e.docId)} />
              ))}
              {pdfEntries.map((e) => (
                <PdfEvidenceCard key={e.key} data={e.data} doc={docMap.get(e.docId)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Row 4: AI Summary ─────────────────────────────────────────────── */}
        {analysis.analysis_summary && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/30 px-4 py-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">AI Decision Summary</p>
            <p className="text-sm text-slate-300 leading-relaxed">{analysis.analysis_summary}</p>
            <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
              <span>Confidence: <span className="text-slate-300 font-medium">{(analysis.confidence_score * 100).toFixed(0)}%</span></span>
              <span className={`w-2 h-2 rounded-full ${analysis.is_complete ? 'bg-emerald-400' : 'bg-amber-400'} inline-block`} />
              <span>{analysis.is_complete ? 'Analysis complete' : 'Analysis in progress'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
