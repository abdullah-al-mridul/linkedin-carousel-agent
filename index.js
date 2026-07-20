import { GoogleGenAI } from "@google/genai";
import puppeteer from "puppeteer";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  console.error("Error: GEMINI_API_KEY is missing in the .env file.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const palettes = [
  { name: "Neon Emerald", bg: "#0d0f11", accent: "#10b981", textHi: "#34d399" },
  { name: "Cyber Violet", bg: "#0f0c1b", accent: "#8b5cf6", textHi: "#a78bfa" },
  {
    name: "Electric Cyan",
    bg: "#081018",
    accent: "#06b6d4",
    textHi: "#22d3ee",
  },
  { name: "Sunset Amber", bg: "#140d0b", accent: "#f59e0b", textHi: "#fbbf24" },
  { name: "Hot Pink", bg: "#120910", accent: "#ec4899", textHi: "#f472b6" },
];

const topic = process.argv.slice(2).join(" ");
if (!topic) {
  console.log('Usage: node index.js "<Your Topic Here>"');
  process.exit(1);
}

function getUniqueOutputDir(basePath = "./output") {
  if (!fs.existsSync(basePath)) {
    return basePath;
  }

  let counter = 2;
  while (fs.existsSync(`${basePath}-${counter}`)) {
    counter++;
  }
  return `${basePath}-${counter}`;
}

async function generateSlideContent(topic) {
  console.log(`[1/3] Generating content for: "${topic}"...`);

  const prompt = `
    You are an expert LinkedIn Carousel creator. Create 5-6 slides about "${topic}".
    Output strictly in valid JSON format. No markdown, no extra text.
    Format:
    [
      {
        "slideNumber": "01 / 05",
        "category": "SHORT TAG",
        "title": "Main punchy title. Wrap one important word in <span> like this: <span>Word</span>",
        "codeSnippet": "Optional code snippet. Format long code lines with line breaks so they fit nicely inside a code block. Leave empty if none.",
        "description": "1-2 sentence explanation."
      }
    ]
    `;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      temperature: 0.2,
    },
  });

  let text = response.text;
  text = text
    .replace(/```json\n/g, "")
    .replace(/```\n?/g, "")
    .trim();

  return JSON.parse(text);
}

function getHtmlTemplate(slide, palette) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
      
      <!-- Highlight.js Syntax Highlighting Theme (Tokyo Night Dark) -->
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/tokyo-night-dark.min.css">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
      
      <style>
        body { font-family: 'Inter', sans-serif; background-color: ${palette.bg}; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        span { color: ${palette.textHi}; }
        /* Make highlight.js background transparent to match your aesthetic */
        .hljs { background: transparent !important; padding: 0 !important; }
        pre { margin: 0 !important; padding: 0 !important; }
      </style>
    </head>
    <body class="text-white flex items-center justify-center h-screen w-screen m-0 p-0 overflow-hidden">
      
      <div class="relative w-[1080px] h-[1350px] flex flex-col justify-between p-20 overflow-hidden" style="background-color: ${palette.bg}; border: 1px solid rgba(255,255,255,0.05);">
        
        <!-- Ambient Glow -->
        <div class="absolute -bottom-40 -left-40 w-[600px] h-[600px] opacity-25 blur-[120px] rounded-full pointer-events-none" style="background-color: ${palette.accent};"></div>

        <!-- Header -->
        <div class="flex items-center justify-between text-2xl font-semibold z-10 pt-4">
          <div class="flex items-center space-x-4">
            <div class="w-4 h-4 rounded-full" style="background-color: ${palette.accent};"></div>
            <span class="text-gray-200 font-bold tracking-tight">Abdullah Al Mridul</span>
          </div>
          <div class="text-gray-400 font-mono text-xl tracking-wider">${slide.slideNumber}</div>
        </div>

        <!-- Main Content -->
        <div class="space-y-12 my-auto z-10 w-[90%]">
          <div class="font-mono text-2xl font-bold tracking-widest uppercase" style="color: ${palette.accent};">
            ${slide.category}
          </div>
          <h1 class="text-8xl font-extrabold text-white leading-[1.1] tracking-tight">
            ${slide.title}
          </h1>
          
       ${
         slide.codeSnippet
           ? `<div class="font-mono text-2xl font-medium leading-relaxed p-6 rounded-2xl border border-white/10 bg-transparent"><pre class="m-0 p-0 whitespace-pre-wrap break-words"><code class="language-javascript m-0 p-0">${slide.codeSnippet.trim()}</code></pre></div>`
           : ""
       }

          <p class="text-gray-400 text-3xl leading-normal max-w-[95%] pt-4">
            ${slide.description}
          </p>
        </div>

  
      </div>

      <script>
        // Trigger Highlight.js on page render
        hljs.highlightAll();
      </script>
    </body>
    </html>
    `;
}

async function renderImages(slides, palette) {
  const outputDir = getUniqueOutputDir("./output");
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(
    `[2/3] Selected Theme: ${palette.name}. Saving files to "${outputDir}"...`,
  );

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });

  for (let i = 0; i < slides.length; i++) {
    const html = getHtmlTemplate(slides[i], palette);
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });

    const fileName = `${outputDir}/slide-${i + 1}.png`;
    await page.screenshot({ path: fileName });
    console.log(`✓ Rendered: ${fileName}`);
  }

  await browser.close();
  console.log(`[3/3] Build complete! Check the ${outputDir} directory.`);
}

async function main() {
  try {
    const slides = await generateSlideContent(topic);
    const randomPalette = palettes[Math.floor(Math.random() * palettes.length)];
    await renderImages(slides, randomPalette);
  } catch (error) {
    console.error("Execution failed:", error.message);
  }
}

main();
