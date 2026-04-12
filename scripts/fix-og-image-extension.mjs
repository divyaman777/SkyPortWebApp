#!/usr/bin/env node
/**
 * Post-build SEO fix.
 *
 * Next.js emits `opengraph-image` and `twitter-image` as extensionless files
 * under `output: 'export'`. Static hosts like GitHub Pages then serve those
 * files with a generic `application/octet-stream` Content-Type, which causes
 * Facebook, Twitter, LinkedIn, Slack, and Discord link previews to silently
 * drop the image.
 *
 * This script:
 *   1. Renames each extensionless image in `out/` to `<name>.png`.
 *   2. Rewrites every HTML, TXT, and RSC payload that referenced the old path
 *      (including any cache-busting query string) to point at the new `.png`.
 *
 * It's idempotent — safe to run multiple times.
 */

import { readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'out')

const IMAGE_NAMES = ['opengraph-image', 'twitter-image']
const REWRITE_EXTS = new Set(['.html', '.txt', '.xml', '.json', '.webmanifest'])

/**
 * Recursively walk a directory and yield every file path.
 */
async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      yield* walk(full)
    } else if (entry.isFile()) {
      yield full
    }
  }
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!(await exists(OUT_DIR))) {
    console.error(`[fix-og-image] ${OUT_DIR} does not exist. Run \`next build\` first.`)
    process.exit(1)
  }

  // 1. Rename extensionless image files to .png
  const renamed = []
  for (const name of IMAGE_NAMES) {
    const src = join(OUT_DIR, name)
    const dst = join(OUT_DIR, `${name}.png`)
    if (await exists(src)) {
      await rename(src, dst)
      renamed.push(name)
      console.log(`[fix-og-image] renamed ${relative(ROOT, src)} → ${relative(ROOT, dst)}`)
    } else if (await exists(dst)) {
      renamed.push(name)
      console.log(`[fix-og-image] already renamed: ${relative(ROOT, dst)}`)
    }
  }

  if (renamed.length === 0) {
    console.log('[fix-og-image] no images to rename; skipping.')
    return
  }

  // 2. Rewrite every reference in text assets.
  //    We replace `opengraph-image?<hash>` (the default cache-busted form Next
  //    emits) AND bare `/opengraph-image"` references to the `.png` variant.
  let rewritten = 0
  for await (const file of walk(OUT_DIR)) {
    const ext = file.slice(file.lastIndexOf('.'))
    if (!REWRITE_EXTS.has(ext)) continue

    let text
    try {
      text = await readFile(file, 'utf8')
    } catch {
      continue
    }

    const original = text
    for (const name of renamed) {
      // Replace `name?foo` with `name.png?foo`
      text = text.replaceAll(
        new RegExp(`/${name}\\?`, 'g'),
        `/${name}.png?`,
      )
      // Replace bare `/name` (followed by quote, space, end) with `/name.png`
      text = text.replaceAll(
        new RegExp(`/${name}(?=["'\\\\\\s<>])`, 'g'),
        `/${name}.png`,
      )
    }

    if (text !== original) {
      await writeFile(file, text, 'utf8')
      rewritten += 1
      console.log(`[fix-og-image] rewrote references in ${relative(ROOT, file)}`)
    }
  }

  console.log(
    `[fix-og-image] done — renamed ${renamed.length} image(s), updated ${rewritten} file(s).`,
  )
}

main().catch((err) => {
  console.error('[fix-og-image] fatal:', err)
  process.exit(1)
})
