// PostToolUse hook（Node 版・OS 非依存）: ファイル編集後の軽量チェック。
// 目的: 構文エラーなどの単純ミスを早期検知する（人間が忘れても自動で走る）。
// 方針: 警告に留め、開発を止めない（常に exit 0）。自社の lint/format に置き換えてよい。
// Claude Code は hook 入力の JSON を stdin で渡す。node は win/mac/linux で同一に動くため、
// settings.json は "command": "node .claude/hooks/check.js" の1本で全 OS に対応する（sh/ps1 不要）。
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  let file = '';
  try { file = (JSON.parse(raw).tool_input || {}).file_path || ''; } catch { /* 入力なし/非JSON は無視 */ }
  if (file) {
    try {
      if (/\.(js|cjs|mjs)$/.test(file)) {
        // node 自身で構文チェック（process.execPath = 実行中の node）
        execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
      } else if (/\.json$/.test(file)) {
        JSON.parse(fs.readFileSync(file, 'utf8'));
      } else if (/\.py$/.test(file)) {
        const py = process.platform === 'win32' ? 'python' : 'python3';
        execFileSync(py, ['-m', 'py_compile', file], { stdio: 'inherit' });
      }
    } catch (e) {
      // 構文エラー等は警告として表示し、開発は止めない
      if (e && e.message) process.stderr.write(String(e.message) + '\n');
    }
  }
  process.exit(0);
});
