interface CitationHeaderProps {
  ruleId: string;
  citation: string;
}

export function CitationHeader({ ruleId, citation }: CitationHeaderProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-400">
        {ruleId}
      </span>
      <span className="text-slate-200">{citation}</span>
    </div>
  );
}
