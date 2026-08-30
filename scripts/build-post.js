import fs from "fs";
import path from "path";

const clientDir = path.resolve("dist/client");
const assetsDir = path.join(clientDir, "assets");

if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir);
  const cssFile = files.find((f) => f.endsWith(".css"));
  const jsFiles = files.filter((f) => f.endsWith(".js"));

  const jsTags = jsFiles.map((f) => `<script type="module" crossorigin src="/assets/${f}"></script>`).join("\n    ");

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Skylark Drones - BI Dashboard & AI Executive Assistant</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=skylark2" />
    <link rel="icon" type="image/png" href="/favicon.png?v=skylark2" />
    <link rel="shortcut icon" href="/favicon.ico?v=skylark2" type="image/x-icon" />
    ${cssFile ? `<link rel="stylesheet" crossorigin href="/assets/${cssFile}">` : ""}
  </head>
  <body class="bg-slate-950 text-slate-100 font-sans">
    <div id="root"></div>
    ${jsTags}
  </body>
</html>`;

  fs.writeFileSync(path.join(clientDir, "index.html"), htmlContent);
  console.log("Successfully generated production dist/client/index.html with bundles:", { cssFile, jsFiles });
}
