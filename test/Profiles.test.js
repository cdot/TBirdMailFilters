import test from "node:test";
import assert from "node:assert/strict";
import { promises as Fs } from "fs";
import { Profiles } from "../src/Profiles.js";

test("reads profile.ini", () => {
  return Fs.readFile(`${process.env.HOME}/.thunderbird/profiles.ini`, "utf8")
  .then(text => new Profiles(text))
  .then(d => console.log(d));
});
