/* scripts/postinstall.js
   Patch automatico per react-native-sqlite-storage:
   rimuove jcenter() (non supportato su Gradle recenti) e usa mavenCentral().
*/
const fs = require("fs");
const path = require("path");

function patchGradleFile(filePath) {
  if (!fs.existsSync(filePath)) return { filePath, changed: false, skipped: true };

  const before = fs.readFileSync(filePath, "utf8");

  // Se non contiene jcenter(), non tocchiamo nulla
  if (!before.includes("jcenter()")) {
    return { filePath, changed: false, skipped: false };
  }

  // Sostituzione semplice e idempotente
  const after = before.replace(
    /repositories\s*\{\s*[^}]*jcenter\(\)\s*[^}]*\}/m,
    `repositories {\n        google()\n        mavenCentral()\n    }`
  );

  // Se la regex non becca (formati strani), fallback: replace secco jcenter()
  const finalText =
    after === before ? before.replace(/jcenter\(\)/g, "mavenCentral()") : after;

  if (finalText !== before) {
    fs.writeFileSync(filePath, finalText, "utf8");
    return { filePath, changed: true, skipped: false };
  }

  return { filePath, changed: false, skipped: false };
}

function main() {
  const root = process.cwd();
  const targets = [
    path.join(root, "node_modules", "react-native-sqlite-storage", "platforms", "android", "build.gradle"),
    path.join(root, "node_modules", "react-native-sqlite-storage", "platforms", "android-native", "build.gradle"),
  ];

  const results = targets.map(patchGradleFile);

  const changed = results.filter(r => r.changed).map(r => r.filePath);
  const skipped = results.filter(r => r.skipped).map(r => r.filePath);

  if (changed.length) {
    console.log("[postinstall] Patched react-native-sqlite-storage:");
    changed.forEach(f => console.log(" -", f));
  } else {
    console.log("[postinstall] No sqlite gradle patch needed.");
  }

  if (skipped.length) {
    console.log("[postinstall] Skipped (not found):");
    skipped.forEach(f => console.log(" -", f));
  }
}

main();
