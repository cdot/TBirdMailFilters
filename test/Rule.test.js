import test from "node:test";
import assert from "node:assert/strict";
import { Rule } from "../src/Rule.js";
import { Gmail } from "../src/Gmail.js";

test("parses a basic Thunderbird rule", () => {
  const input = 'version="9"\nname="Invoices"\nenabled="yes"\nactionCount="1"\naction0="MoveToFolder"\nactionValue0="imap://me@example.com/Invoices"\ncondition="AND (from,contains,alice@example.com) (subject,contains,invoice)"\n';
  const rule = new Rule(input);
  assert.equal(rule.name, "Invoices");
  assert.equal(rule.actions[0].type, "MoveToFolder");

  const translated = new Gmail(rule);
  assert.match(translated.criteria.query, /from:alice@example\.com/);
  assert.equal(translated.labelName, "Invoices");
});
