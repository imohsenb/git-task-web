#!/usr/bin/env node
import { buildServer } from "./main.js";

const port = Number(process.env.GIT_TASK_WEB_PORT ?? 4600);
const host = process.env.GIT_TASK_WEB_HOST ?? "127.0.0.1";

const app = await buildServer();
await app.listen({ port, host });

const url = `http://${host === "0.0.0.0" ? "localhost" : host}:${port}`;
app.log.info(`git-task-web listening on ${url}`);
