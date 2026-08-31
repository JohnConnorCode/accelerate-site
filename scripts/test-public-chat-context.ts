#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boundFounderConversation, MAX_CONVERSATION_CONTEXT_CHARS } from "../src/lib/revenue-os/ai-context";

const chatRoute = readFileSync("src/app/api/chat/route.ts", "utf8");
assert.match(chatRoute, /boundFounderConversation\(messages\)/, "public chat must use the shared bounded conversation path");
assert.match(chatRoute, /buildPublicChatGroundingContract\(\)/, "public chat must append its source and untrusted-data contract");
assert.match(chatRoute, /context_version: AI_CONTEXT_VERSION/, "public chat traces must identify the applied context contract");

const messages = Array.from({ length: 20 }, (_, index) => ({ role: index % 2 ? "assistant" as const : "user" as const, content: String(index).repeat(2_000) }));
const bounded = boundFounderConversation(messages);
assert.ok(bounded.length < messages.length, "the shared context cap must trim long public conversations");
assert.ok(bounded.reduce((total, message) => total + message.content.length, 0) <= MAX_CONVERSATION_CONTEXT_CHARS);

console.log(JSON.stringify({ result: "passed", checks: ["shared-conversation-cap", "public-source-contract", "untrusted-visitor-boundary", "context-trace-receipt"] }, null, 2));
