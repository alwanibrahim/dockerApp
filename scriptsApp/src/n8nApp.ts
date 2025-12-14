#!/usr/bin/env bun
// @ts-nocheck

import { mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import os from "os";

// ===============================
// PARSE ARGV
// ===============================
const args = process.argv.slice(2);

const getArg = (key: string) => {
  const i = args.indexOf(key);
  return i !== -1 ? args[i + 1] : null;
};

const APP_NAME = getArg("--name");
const PORT = getArg("--port");

// ===============================
// VALIDATION
// ===============================
if (!APP_NAME || !PORT) {
  console.error("Usage:");
  console.error("bun src/n8nApp.ts --name 2n8nApp --port 5679");
  process.exit(1);
}

// ===============================
// FIXED BASE PATH
// ~/dockerApp/n8nApp/<APP_NAME>
// ===============================
const HOME = os.homedir();
const BASE_DIR = path.join(HOME, "dockerApp", "n8nApp", APP_NAME);

const NETWORK_NAME = `${APP_NAME}_net`;
const VOLUME_NAME = APP_NAME;

// ===============================
// FILE CONTENT
// ===============================
const envContent = `# ===== CORE =====
N8N_HOST=0.0.0.0
N8N_PORT=${PORT}
N8N_PROTOCOL=http
N8N_LISTEN_ADDRESS=0.0.0.0

# ===== AUTH =====
N8N_BASIC_AUTH_ACTIVE=true
# ===== PERMISSION =====
N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true

# ===== TIMEZONE =====
TZ=Asia/Jakarta
`;

const composeContent = `name: ${APP_NAME}

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: ${APP_NAME}
    restart: unless-stopped

    ports:
      - "\${N8N_PORT}:5678"

    env_file:
      - .env

    volumes:
      - ${VOLUME_NAME}:/home/node/.n8n

    networks:
      - ${NETWORK_NAME}

networks:
  ${NETWORK_NAME}:
    name: ${NETWORK_NAME}
    driver: bridge

volumes:
  ${VOLUME_NAME}:
`;

// ===============================
// EXECUTION
// ===============================
(async () => {
  if (existsSync(BASE_DIR)) {
    console.error(`❌ Folder already exists: ${BASE_DIR}`);
    process.exit(1);
  }

  await mkdir(BASE_DIR, { recursive: true });

  await writeFile(path.join(BASE_DIR, ".env"), envContent);
  await writeFile(path.join(BASE_DIR, "compose.yaml"), composeContent);

  console.log("✅ n8n project created");
  console.log(`Name   : ${APP_NAME}`);
  console.log(`Port   : ${PORT}`);
  console.log(`Path   : ${BASE_DIR}`);
  console.log("");
  console.log(`Next step:`);
  console.log(`cd ${BASE_DIR} && docker compose up -d`);
})();
