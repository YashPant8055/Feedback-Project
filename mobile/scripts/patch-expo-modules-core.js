const fs = require("fs");
const path = require("path");

function patchFile(filePath, applyPatch) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const original = fs.readFileSync(filePath, "utf8");
  const updated = applyPatch(original);
  if (updated !== original) {
    fs.writeFileSync(filePath, updated, "utf8");
  }
}

function ensureImport(source, importLine) {
  if (source.includes(importLine)) {
    return source;
  }
  const packageMatch = source.match(/package\s+[^;]+;\s*\n/);
  if (!packageMatch) {
    return source;
  }
  return source.replace(
    packageMatch[0],
    `${packageMatch[0]}\n${importLine}\n`
  );
}

function ensureFile(filePath, contents) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, contents, "utf8");
  }
}

function ensureMethod(source, marker, methodBlock) {
  if (source.includes(methodBlock.trim())) {
    return source;
  }
  if (!source.includes(marker)) {
    return source;
  }
  return source.replace(marker, `${methodBlock}\n${marker}`);
}

const uiManagerPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo-modules-core",
  "android",
  "src",
  "main",
  "java",
  "expo",
  "modules",
  "core",
  "interfaces",
  "services",
  "UIManager.java"
);

patchFile(uiManagerPath, (source) => {
  let updated = ensureImport(source, "import android.view.View;");
  if (!updated.includes("View resolveView(int viewTag);")) {
    updated = updated.replace(
      /\n}\s*$/,
      "\n\n  View resolveView(int viewTag);\n}\n"
    );
  }
  return updated;
});

const keepAwakePath = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo-modules-core",
  "android",
  "src",
  "main",
  "java",
  "expo",
  "modules",
  "core",
  "interfaces",
  "services",
  "KeepAwakeManager.java"
);

ensureFile(
  keepAwakePath,
  [
    "package expo.modules.core.interfaces.services;",
    "",
    "public interface KeepAwakeManager {",
    "  void activate(String tag);",
    "  void deactivate(String tag);",
    "  void deactivateAll();",
    "  boolean isActivated();",
    "}",
    "",
  ].join("\n")
);

const wrapperPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "expo-modules-core",
  "android",
  "src",
  "main",
  "java",
  "expo",
  "modules",
  "adapters",
  "react",
  "services",
  "UIManagerModuleWrapper.java"
);

patchFile(wrapperPath, (source) => {
  let updated = ensureImport(source, "import android.view.View;");
  updated = ensureImport(
    updated,
    "import com.facebook.react.uimanager.UIManagerHelper;"
  );

  const marker = "  public long getJavaScriptContextRef() {";
  const methodBlock = [
    "  @Override",
    "  public View resolveView(int viewTag) {",
    "    return UIManagerHelper.getUIManagerForReactTag(getContext(), viewTag).resolveView(viewTag);",
    "  }",
    "",
  ].join("\n");

  updated = ensureMethod(updated, marker, methodBlock);
  return updated;
});
