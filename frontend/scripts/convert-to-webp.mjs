import sharp from "sharp";
import { readdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const ASSETS = "src/assets";
const QUALITY = 82; // WebP 품질 (0-100), 82 = 화질/용량 균형

const files = await readdir(ASSETS);
const pngs = files.filter(f => f.endsWith(".png"));

console.log(`\n변환 대상 PNG: ${pngs.length}개\n`);

let totalBefore = 0, totalAfter = 0;

for (const file of pngs) {
  const src  = path.join(ASSETS, file);
  const dest = path.join(ASSETS, file.replace(/\.png$/, ".webp"));

  const { size: before } = await import("fs").then(m => m.promises.stat(src));
  await sharp(src).webp({ quality: QUALITY }).toFile(dest);
  const { size: after } = await import("fs").then(m => m.promises.stat(dest));

  const saved = ((before - after) / before * 100).toFixed(1);
  totalBefore += before;
  totalAfter  += after;

  console.log(
    `${file.padEnd(28)} ${(before/1024/1024).toFixed(2)} MB → ${(after/1024/1024).toFixed(2)} MB  (-${saved}%)`
  );
}

console.log(`\n${"─".repeat(60)}`);
console.log(`합계  ${(totalBefore/1024/1024).toFixed(1)} MB → ${(totalAfter/1024/1024).toFixed(1)} MB  (-${((totalBefore-totalAfter)/totalBefore*100).toFixed(1)}%)`);
console.log(`\n✅ WebP 파일 생성 완료. import 경로를 .webp 로 교체한 뒤 PNG를 삭제하세요.`);
