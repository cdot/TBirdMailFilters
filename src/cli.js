#!/usr/bin/env node
import { promises as Fs } from "fs";
import getopt from "posix-getopt";
import path from "path";

import { Rule } from "./Rule.js";
import { Gmail } from "./Gmail.js";
import { Accounts } from "./Accounts.js";
import { Profiles } from "./Profiles.js";

class CLI {
  constructor() {
    this.thunDir = undefined;   // Root of Thunderbird data files

    this.profiles = undefined;  // List of profiles
    this.accounts = undefined;  // List of accounts
    this.profile = undefined;   // Name of the current profile
    this.account = undefined;   // Name of selected account

    this.list_profiles = false; // true to get list of profiles
    this.list_accounts = false; // true to get list of accounts
    this.list_rules = false;    // true to get list of rules
    this.filter = undefined;    // List of rules to keep

    this.copyFile = undefined;  // Place to dump msgFilterRules.dat
    this.gmailFile = undefined; // Place to dump Gmail XML
  }

  usage(mess) {
    const DESCRIPTION = [
      "Explore Thunderbird mail filters, and export subsets in",
      "`msgFilterRules.dat` format and/or map to Gmail format filters.",
      "\nUSAGE",
      "\tnpm start -- [options]",
      "\nOPTIONS",
      "\t-t, --tbird <path> - path to Thunderbird directory,",
      `\t\t default "${this.thunDir}"`,
      "\t-P, --Profiles - list available user profiles and exit",
      "\t-p, --profile <name> - select the user profile,",
      `\t\tdefault "${this.profile}"`,
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

  /**
   * Determine where Thunderbird data files live.
   * May be overridden by a --tbird option
   */
  getThunDir() {
    function exists(f) {
      return Fs.stat(f)
      .then(s => {
        if (s.isDirectory())
          return f;
        return Promise.reject();
      });
    }

    // env var overrides all (except --tbird)
    if (process.env.TBIRD_INSTALL)
      return Promise.resolve(process.env.TBIRD_INSTALL);

    // Otherwise look in usual places
    const promises = [
      exists(`${process.env.HOME}/.thunderbird`),
      exists('C:\\Users\\YourUserName\\AppData\\Roaming\\Thunderbird')
    ];
    return Promise.any(promises)
    .then(td => this.thunDir = td);
  }

  /**
   * Load the known profiles, and select the default if the
   * options didn't provide a profile name.
   * Default may not be defined?
   */
  getProfile() {
    return Fs.readFile(`${this.thunDir}/profiles.ini`, "utf8")
      .then(text => {
        this.profiles = new Profiles(text);
        this.profile ||= this.profiles.Default;
      });
  }

  getOptions() {
    const go_parser = new getopt.BasicParser(
      "t:(tbird)p:(profile)P(Profiles)a:(account)A(Accounts)r:(rules)R(Rules)c:(copy)g:(gmail)h(help)",
      process.argv);
    let option;
    while ((option = go_parser.getopt())) {
      switch (option.option) {
      default: this.usage(`Unsupported option ${option.option}`);
      case 't': this.thunDir = option.optarg; break;
      case 'p': this.profile = option.optarg; break;
      case 'P': 
        console.log(this.profiles);
        process.exit(0);
      case 'a': this.account = option.optarg; break;
      case 'A': this.list_accounts = true; break;
      case 'r': this.filter = option.optarg.split(","); break;
      case 'R': this.list_rules = true; break;
      case 'c': this.copyFile = option.optarg; break;
      case 'g': this.gmailFile = option.optarg; break;
      case 'h':
      case '?': this.usage();
      }
    }
    console.debug(`Thunderbird files at '${this.thunDir}'`);
  }

  getAccount() {
    return Fs.readFile(`${this.thunDir}/${this.profile}/prefs.js`, "utf8")
    .then(text => new Accounts(text))
    .then(accounts => {
      this.accounts = accounts;
      if (this.list_accounts) {
        console.log(this.accounts);
        process.exit(0);
      }
      const accnames = Object.keys(accounts);
      if (accnames.length === 1 && !this.account)
        this.account = accnames[0];
      else if (!this.account)
        throw new Error(`Multiple accounts in ${this.profile}, require --account to choose one of ${accnames.join(",")}`);
      console.debug(`Account ${this.account} ${accounts[this.account]}`);
    })
    .catch(e => {
      console.error(e);
      process.exit(1);
    });
  }

  getRules() {
    return Fs.readFile(
      `${this.accounts[this.account]}/msgFilterRules.dat`, "utf8")
    .then(text => this.rules = Rule.parseRules(text))
    .then(() => {
      if (this.list_rules) {
        console.log("Rules {");
        console.log(this.rules.map(r => `  "${r.name}"`).join(",\n"));
        console.log("}");
      }

      if (this.filter)
        // Filter the rules for further processing
        this.rules = this.rules.filter(r => (this.filter.indexOf(r.name) >= 0));
    });
  }

  // Regenerate the filtered rules in msgFilterRules.dat format
  putMsgFilterRules() {
    if (!this.copyFile)
      return;

    const text = this.rules.map(r => r.raw).join("\n");
    if (this.copyFile === "-")
      console.log(text);
    else {
      // no need to await this, it can safely be done in parallel
      Fs.writeFile(this.copyFile, text, "utf8")
      .then(() => console.log(`Wrote Thunderbird rules to ${this.copyFile}`));
    }
  }

  // Generate the filtered rules as Gmail rules
  putGmailRules() {
    if (!this.gmailFile)
      return;

    const gmail_rules = this.rules.map(r => new Gmail(r));
    const xml = Gmail.rules2XML(gmail_rules, { email: this.account });
    console.warn(gmail_rules.flatMap(r => r.warnings).join("\n"));
    if (this.gmailFile === "-")
      console.log(xml);
    else
      // no need to await this, it can safely be done in parallel
      Fs.writeFile(this.gmailFile, xml, "utf8")
      .then(() => console.log(`Wrote Gmail filter XML to ${this.gmailFile}`));
  }

  run() {
    return this.getThunDir()
    .then(() => this.getProfile())
    .then(() => this.getOptions())
    .then(() => this.getAccount())
    .then(() => this.getRules())
    .then(() => this.putMsgFilterRules())
    .then(() => this.putGmailRules());
  }
}

new CLI().run();
