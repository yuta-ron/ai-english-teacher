"use client";

export type Accent = "american" | "british" | "australian" | "canadian" | "indian";

export const ACCENTS: { id: Accent; flag: string; label: string }[] = [
  { id: "american",   flag: "🇺🇸", label: "アメリカ" },
  { id: "british",    flag: "🇬🇧", label: "イギリス" },
  { id: "australian", flag: "🇦🇺", label: "オーストラリア" },
  { id: "canadian",   flag: "🇨🇦", label: "カナダ" },
  { id: "indian",     flag: "🇮🇳", label: "インド" },
];

interface AccentSelectorProps {
  value: Accent;
  onChange: (accent: Accent) => void;
  disabled?: boolean;
}

export function AccentSelector({ value, onChange, disabled }: AccentSelectorProps) {
  return (
    <div className="w-full flex flex-col gap-1.5">
      <p className="text-xs text-slate-400 text-center">英語の種類</p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {ACCENTS.map((accent) => {
          const isSelected = value === accent.id;
          return (
            <button
              key={accent.id}
              onClick={() => onChange(accent.id)}
              disabled={disabled}
              title={accent.label}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors
                ${isSelected
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              <span className="text-sm leading-none">{accent.flag}</span>
              <span>{accent.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
