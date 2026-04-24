const http = require("http");
const fs = require("fs");
const path = require("path");

const publicDir = path.join(__dirname, "public");

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  const lines = envContent.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=UTF-8"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=UTF-8" });
  response.end(JSON.stringify(payload));
}

function serveFile(filePath, response) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 404, { ok: false, message: "Файл не найден." });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  });
}

function formatMessage(data) {
  return [
    "Новая заявка с сайта Aivion",
    "",
    `Имя: ${data.firstName}`,
    `Фамилия: ${data.lastName}`,
    `Компания: ${data.company}`,
    `Роль: ${data.role === "Другое" ? `${data.role} (${data.customRole || "не указано"})` : data.role || "не указано"}`,
    `Размер команды: ${data.teamSize || "не указано"}`,
    `Бюджет: ${data.budget || "не указано"}`,
    `Контакт: ${data.contact}`,
    "",
    "Описание задачи:",
    data.details || "Не указано"
  ].join("\n");
}

function validatePayload(payload) {
  const requiredFields = ["firstName", "lastName", "company", "contact"];

  for (const field of requiredFields) {
    if (!payload[field] || !String(payload[field]).trim()) {
      return `Поле "${field}" обязательно.`;
    }
  }

  if (payload.role === "Другое" && !String(payload.customRole || "").trim()) {
    return "Укажите роль в компании.";
  }

  return null;
}

async function handleContact(request, response) {
  const chunks = [];

  request.on("data", (chunk) => {
    chunks.push(chunk);
  });

  request.on("end", async () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const validationError = validatePayload(body);

      if (validationError) {
        sendJson(response, 400, { ok: false, message: validationError });
        return;
      }

      const token = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (!token || !chatId) {
        sendJson(response, 500, {
          ok: false,
          message: "Не настроены TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID."
        });
        return;
      }

      const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: formatMessage(body)
        })
      });

      const telegramPayload = await telegramResponse.json();

      if (!telegramResponse.ok || !telegramPayload.ok) {
        throw new Error(telegramPayload.description || "Telegram API вернул ошибку.");
      }

      sendJson(response, 200, { ok: true, message: "Заявка отправлена." });
    } catch (error) {
      console.error(error);
      sendJson(response, 500, {
        ok: false,
        message: "Не удалось отправить заявку. Попробуйте снова."
      });
    }
  });
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && (requestUrl.pathname === "/contact" || requestUrl.pathname === "/contact/")) {
    serveFile(path.join(publicDir, "index.html"), response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/contact") {
    handleContact(request, response);
    return;
  }

  const requestedPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    sendJson(response, 403, { ok: false, message: "Доступ запрещён." });
    return;
  }

  serveFile(filePath, response);
});

server.listen(port, () => {
  console.log(`Aivion запущен: http://127.0.0.1:${port}`);
});
