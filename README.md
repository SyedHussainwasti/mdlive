# Markdown Live

A Markdown editor with instant live preview — type on the left, see rendered HTML on the right.

## How to use

Open `index.html` in any browser. Type Markdown in the left pane; the preview
updates on every keystroke. Hit **Copy HTML** to grab the rendered output.

## How it works

- A hand-written ~60-line parser (no libraries): fenced code blocks are
  extracted first, then a line-by-line pass builds headings, lists,
  blockquotes, rules, and paragraphs; inline styles (bold, italic, code,
  links) are applied per block.
- All raw HTML is escaped before rendering; code blocks and inline code are
  double-protected so `<script>` can never execute.
- 100% client-side, zero network requests.
