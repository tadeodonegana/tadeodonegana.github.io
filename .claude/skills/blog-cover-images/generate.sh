#!/usr/bin/env bash
# Generate one blog post cover image in the site's monochrome two-tone style.
#
#   export OPENROUTER_API_KEY=sk-or-...
#   SUBJECT="One large hand-drawn ring with three dots on it. Nothing else." \
#     .claude/skills/blog-cover-images/generate.sh react-agent-framework-by-scratch-python cover.png
#
# Writes ./out/<slug>.raw.<ext> and ./out/<slug>.png. Never touches the repo.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
OUT="${OUT:-./out}"
MODEL="${MODEL:-google/gemini-3-pro-image}"

SLUG="${1:-}"
DEST="${2:-cover.png}"

if [[ -z "$SLUG" ]]; then
  echo "usage: SUBJECT='...' $0 <slug> [dest-filename]" >&2
  exit 1
fi
: "${OPENROUTER_API_KEY:?Set OPENROUTER_API_KEY first}"
: "${SUBJECT:?Set SUBJECT to the per-image description}"

command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

if [[ ! -d "$REPO/src/content/post/$SLUG" ]]; then
  echo "warning: no post folder at src/content/post/$SLUG" >&2
fi

mkdir -p "$OUT"

# ---------------------------------------------------------------------------
# Shared style block. Keep this IDENTICAL across every image in the set — if each
# cover describes its own style the set stops reading as one system.
#
# Palette matches :root.dark in src/styles/global.css:
#   #1d1f20 = --theme-bg      #ededed = --theme-accent-2
# ---------------------------------------------------------------------------
STYLE=$(cat <<'EOF'
STYLE — follow exactly:

Flat two-tone hand-drawn illustration. Solid dark charcoal background (#1d1f20),
completely plain and even: no gradient, no vignette, no texture, no noise, no
paper grain. Every drawn element is one single flat light grey (#ededed) with no
shading, no gradient, no outline, no highlight and no second tone anywhere.
Strictly two colours in the whole image — the charcoal background and the light
grey marks. Absolutely no other colour: no blue, no purple, no cyan, no warm
tint, no coloured edge, no coloured glow.

Drawn by hand with a thick blunt marker. The line carries a visible tremble,
circles are not perfectly round, straight edges wander slightly, corners are soft
and organic, and stroke width varies a little along its length. It must look
authored by a person rather than plotted by a machine — but confident and
deliberate, never sketchy, scribbled or messy. No construction lines, no
crosshatching, no stippling, no fill texture.

Radically reductive: very few elements, enormous empty space, one single idea
stated once and clearly. Flat and frontal — no perspective, no isometric
projection, no 3D rendering, no depth of field, no drop shadow, no glow, no
bloom, no particles, no sparkle. Bold enough to read clearly at 400 pixels wide.

Absolutely no text, no letters, no numbers, no labels, no logos, no watermarks
and no user interface chrome anywhere in the image.
EOF
)

prompt="SUBJECT: ${SUBJECT}"$'\n\n'"$STYLE"

echo "==> $SLUG"

body=$(jq -n --arg model "$MODEL" --arg prompt "$prompt" \
  '{model: $model, prompt: $prompt, n: 1, aspect_ratio: "16:9", resolution: "2K"}')

resp=$(curl -sS -X POST https://openrouter.ai/api/v1/images \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$body")

if ! echo "$resp" | jq -e '.data[0].b64_json' >/dev/null 2>&1; then
  echo "    FAILED: $(echo "$resp" | jq -c '.error // .' 2>/dev/null || echo "$resp")" >&2
  exit 1
fi

# This model returns image/jpeg despite the .png you might expect — honour
# media_type so the raw file does not lie about its format.
mt=$(echo "$resp" | jq -r '.data[0].media_type // "image/png"')
case "$mt" in
  image/jpeg) ext="jpg" ;;
  image/webp) ext="webp" ;;
  *)          ext="png" ;;
esac

raw="$OUT/$SLUG.raw.$ext"
echo "$resp" | jq -r '.data[0].b64_json' | base64 --decode > "$raw"
cost=$(echo "$resp" | jq -r '.usage.cost // "?"')
echo "    raw: $raw ($(du -h "$raw" | cut -f1), $mt, \$$cost)"

final="$OUT/$SLUG.png"
if ! NODE_PATH="$REPO/node_modules" node "$HERE/normalize-cover.cjs" "$raw" "$final"; then
  echo "    normalise FAILED — raw file is still usable: $raw" >&2
  exit 1
fi
echo "    -> $final"

# Light-mode variant is a deterministic recolour of the same art — no second
# generation, and the two themes are guaranteed to show the same drawing.
light="$OUT/$SLUG-light.png"
if ! node "$HERE/make-light-variant.cjs" "$final" "$light"; then
  echo "    light variant FAILED" >&2
  exit 1
fi
echo "    -> $light"

destLight="${DEST%.png}-light.png"
echo
echo "    Next: view both, then verify and install:"
echo "      node $HERE/verify.cjs $final"
echo "      cp $final  $REPO/src/content/post/$SLUG/$DEST"
echo "      cp $light $REPO/src/content/post/$SLUG/$destLight"
echo "    Then in src/content/post/$SLUG/index.md set coverImage.alt and:"
echo "      srcLight: \"./$destLight\""
