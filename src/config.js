export const CONFIG = {
  CHUNK_SIZE: 3,
  MAX_OUTPUT_TOKENS: 8192,
  API_TIMEOUT_MS: 90000,
  CONCURRENCY_LIMIT: 3,
  RENDER_SCALE: 2.0,
  RENDER_QUALITY: 0.8,
  MODEL_ID: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MODEL_ID) || 'gemini-2.5-flash',
  MAX_FILE_SIZE_MB: 50,
  ALLOWED_MIME_TYPES: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  CARRYOVER_PATTERN: /前頁より繰越|前ページより繰越|繰越残高/,
  PDF_JS_URL: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  PDF_JS_INTEGRITY: 'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e',
  PDF_JS_URL_FALLBACK: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
  PDF_WORKER_URL: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  PDF_WORKER_URL_FALLBACK: 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
};

export const nextGid = () => crypto.randomUUID();

export const PROMPT_TEMPLATE = `あなたは厳格な経理監査プロフェッショナルです。
添付された通帳のデータ（画像）から、取引明細を【1行の漏れもなく、最初から最後まで全て】正確に読み取ってください。

【絶対遵守の重要ルール】
1. まず画像全体を俯瞰し「総行数」「一番最初の行の日付」「一番最後の行の日付と残高」を正確に把握し、「総行数」と【全く同じ件数】のデータを抽出してください。
2. 【空間認識】各明細行が画像内のどの位置にあるかを示すboundingBox座標を [ymin, xmin, ymax, xmax] (0〜1000の正規化座標)で付与してください。
3. 【チャンクページインデックス】複数枚の画像が添付されている場合、各トランザクションが何枚目の画像（0始まり）に属するかを chunkPageIndex（整数）で必ず指定してください。
4. 【金融機関名】判明している金融機関名はそのまま記載し、不明な箇所は「口座A」などの仮称を入力してください。
5. 【日付】取引日付はすべて「西暦（YYYY/MM/DD）」に統一・変換してください（例: 令和6年5月9日 → 2024/05/09）。日付が省略されている行は前行の日付を補完してください。
6. 【要確認フラグ】印字がかすれている、不鮮明である、または抽出内容に自信がない行は needsReview を true にしてください。このフラグはAIの判断のみで決定し、金額計算では変更しないでください。
7. 【金額フォーマット】金額のカンマは除去し数値文字列のみで返してください（例: 1,234 → 1234）。
8. 【繰越行】「前頁より繰越」「次頁へ繰越」等の繰越行は description に明示し、withdrawal/deposit は空文字にしてください。
9. 【確信度】各行の抽出確信度を0〜100の整数で confidenceScore に記載してください。
10. 出力するJSONの文字列（値）の中には改行文字(\\n)を含めず、Markdown記号も使用しないでください。`;
