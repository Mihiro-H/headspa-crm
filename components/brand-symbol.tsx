// フォレスパのブランドシンボル（葉のマーク）。
// logo/フォルダのPNGはワードマーク込みのロックアップのため、
// シンボル単体としては設計トークン定義のSVGパスをそのまま使用する。
// ラスター画像の切り出しと違い拡大しても劣化しない。
export function BrandSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="195 35 130 170" className={className} role="img" aria-label="フォレスパ">
      <path d="M260,40 C200,80 200,160 260,200 C320,160 320,80 260,40 Z" fill="#6B8E5A" />
      <path
        d="M260,55 Q250,120 260,185"
        fill="none"
        stroke="#C9A66B"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="309" cy="171" r="12" fill="#D98C5F" />
    </svg>
  );
}
