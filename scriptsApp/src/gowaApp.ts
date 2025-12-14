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
const HOST_PORT = getArg("--port");

// ===============================
// VALIDATION
// ===============================
if (!APP_NAME || !HOST_PORT) {
  console.error("Usage:");
  console.error("bun src/gowaApp.ts --name 1gowaApp --port 3002");
  process.exit(1);
}

// ===============================
// FIXED BASE PATH
// ~/dockerApp/gowaApp/<APP_NAME>
// ===============================
const HOME = os.homedir();
const BASE_DIR = path.join(HOME, "dockerApp", "gowaApp", APP_NAME);

const VOLUME_NAME = APP_NAME;
const CONTAINER_PORT = 3000;

// ===============================
// COMPOSE CONTENT
// ===============================
const composeContent = `name: ${APP_NAME}

services:
  whatsapp:
    image: aldinokemal2104/go-whatsapp-web-multidevice
    container_name: ${APP_NAME}
    restart: always

    ports:
      - "${HOST_PORT}:${CONTAINER_PORT}"

    volumes:
      - ${VOLUME_NAME}:/app/storages

    command:
      - rest
      - --basic-auth=admin:admin
      - --port=${CONTAINER_PORT}
      - --debug=true
      - --os=Chrome
      - --account-validation=false

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
  await writeFile(path.join(BASE_DIR, "compose.yaml"), composeContent);

  console.log("✅ GOWA project created");
  console.log(`Name   : ${APP_NAME}`);
  console.log(`Port   : ${HOST_PORT}`);
  console.log(`Path   : ${BASE_DIR}`);
  console.log("");
  console.log(`Next step:`);
  console.log(`cd ${BASE_DIR} && docker compose up -d`);
})();
