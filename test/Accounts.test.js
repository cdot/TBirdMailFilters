import test from "node:test";
import assert from "node:assert/strict";
import { promises as Fs } from "fs";
import { Accounts } from "../src/Accounts.js";

test("reads prefs.ini", () => {
  return Fs.readFile("/home/crawford/.thunderbird/w976d569.crawford/prefs.js", "utf8")
  .then(text => new Accounts(text))
  .then(prefs => console.log(prefs));
});
