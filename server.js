const port = Number(Bun.env.PORT || 3000);
const root = import.meta.dir;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon"
};

function resolvePath(urlPath) {
  if (urlPath === "/" || urlPath === "/Aivion.html") return "index.html";

  const cleanPath = decodeURIComponent(urlPath).replace(/^\/+/, "");
  if (!cleanPath || cleanPath.includes("..")) return null;

  return cleanPath;
}

function getContentType(pathname) {
  const dotIndex = pathname.lastIndexOf(".");
  if (dotIndex === -1) return "application/octet-stream";

  const extension = pathname.slice(dotIndex).toLowerCase();
  return contentTypes[extension] || "application/octet-stream";
}

async function serveFile(relativePath) {
  const file = Bun.file(`${root}/${relativePath}`);

  if (!(await file.exists())) {
    return new Response("Файл не найден", { status: 404 });
  }

  return new Response(file, {
    headers: {
      "Content-Type": getContentType(relativePath)
    }
  });
}

Bun.serve({
  port,
  async fetch(request) {
    const url = new URL(request.url);
    const relativePath = resolvePath(url.pathname);

    if (!relativePath) {
      return new Response("Некорректный путь", { status: 400 });
    }

    return serveFile(relativePath);
  }
});

console.log(`Сервер запущен: http://localhost:${port}`);
