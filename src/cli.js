#!/usr/bin/env node
import { promises as Fs } from "fs";
import getopt from "posix-getopt";
import path from "path";

import { Rule } from "./Rule.js";
import { Gmail } from "./Gmail.js";
import { Accounts } from "./Accounts.js";
import { Profiles } from "./Profiles.js";

let thunDir = `${process.env.HOME}/.thunderbird`;

function usage(mess) {
  const DESCRIPTION = [
    "Explore Thunderbird mail filters, and export subsets in",
    "`msgFilterRules.dat` format and/or map to Gmail format filters.",
    "\nUSAGE",
    "\tnpm start -- [options]",
    "\nOPTIONS",
    "\t-t, --tbird <path> - path to Thunderbird directory,",
    `\t\t default "${thunDir}"`,
    "\t-P, --Profiles - list available user profiles and exit",
    "\t-p, --profile <name> - select the user profile,",
    `\t\tdefault "${profile}"`,
    "\t-A, --Accounts - list the accounts in the selected profile and exit",
    "\t-a, --account <name> - select an account",
    "\t-r, --rules <name[,name]*> - comma-separated list of names of rules",
    "\t\tto process. Default is to process all rules",
    "\t-c, --copy <path> - path to write a copy of msgFilterRules.dat to,",
    "\t\t`-c -` to write to stdout",
    "\t-g, --gmail <path> - path of Gmail XML file to write to,",
    "\t\t`-g -` to write to stdout",
    "\t-h, --help - output this information"
  ];
  if (mess)
    console.error(`*** ${mess}\n`);
  console.error(DESCRIPTION.join("\n"));
  process.exit(2);
}

let profiles, list_profiles, profile,
    accounts, list_accounts, account,
    list_rules, filter,
    copyFile, gmailFile;

Fs.readFile(`${thunDir}/profiles.ini`, "utf8")
.then(text => {
  profiles = new Profiles(text);
  profile = profiles.Default;
})

.then(() => {
  const go_parser = new getopt.BasicParser(
    "t:(tbird)p:(profile)P(Profiles)a:(account)A(Accounts)r:(rules)R(Rules)c:(copy)g:(gmail)h(help)",
    process.argv);
  let option;
  while ((option = go_parser.getopt())) {
    switch (option.option) {
    default: usage(`Unsupported option ${option.option}`);
    case 't': thunDir = option.optarg; break;
    case 'p': profile = option.optarg; break;
    case 'P': list_profiles = true; break;
    case 'a': account = option.optarg; break;
    case 'A': list_accounts = true; break;
    case 'r': filter = option.optarg.split(","); break;
    case 'R': list_rules = true; break;
    case 'c': copyFile = option.optarg; break;
    case 'g': gmailFile = option.optarg; break;
    case 'h':
    case '?': usage();
    }
  }
  if (list_profiles) {
    console.log(profiles);
    process.exit(0);
  }
})

.then(() => Fs.readFile(`${thunDir}/${profile}/prefs.js`, "utf8"))
.then(text => new Accounts(text))
.then(accounts => {
  const accnames = Object.keys(accounts);
  if (list_accounts) {
    console.log(accounts);
    process.exit(0);
  }
  if (accnames.length === 1 && !account)
    account = accnames[0];
  else if (!account)
    throw new Error(`Multiple accounts in ${profile}, require --account to choose one of ${accnames.join(",")}`);
  console.debug(`Account ${account} ${accounts[account]}`);
  return accounts[account];
})
.catch(e => {
  console.error(e);
  throw new Error(`No accounts found in ${profile}`);
})

.then(accountPath => Fs.readFile(`${accountPath}/msgFilterRules.dat`, "utf8"))

.then(text => {
  let rules = Rule.parseRules(text);
  if (list_rules) {
    console.log("Rules {");
    console.log(rules.map(r => `  "${r.name}"`).join(",\n"));
    console.log("}");
  }
  if (filter) {
    // Filter the rules
    rules = rules.filter(r => (filter.indexOf(r.name) >= 0));
  }
  return rules;
})

.then(rules => {
  if (copyFile) {
    // Regenerate the filtered rules in msgFilterRules.dat format
    const text = rules.map(r => r.raw).join("\n");
    if (copyFile === "-")
      console.log(text);
    else {
      // no need to await this, it can safely be done in parallel
      Fs.writeFile(copyFile, text, "utf8")
      .then(() => console.log(`Wrote Thunderbird rules to ${copyFile}`));
    }
  }

  if (gmailFile) {
    // Generate the filtered rules as Gmail rules
    const gmail_rules = rules.map(r => new Gmail(r));
    const xml = Gmail.rules2XML(gmail_rules, { email: account });
    console.warn(gmail_rules.flatMap(r => r.warnings).join("\n"));
    if (gmailFile === "-")
      console.log(xml);
    else {
      Fs.writeFile(gmailFile, xml, "utf8")
      .then(() => console.log(`Wrote Gmail filter XML to ${gmailFile}`));
    }
  }
});

