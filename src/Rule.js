/**
 * Normalized rule records.
 * Thunderbird's condition language is comma-delimited and may contain
 * quoted strings. The parser deliberately preserves unsupported
 * clauses for reporting.
 */
export class Rule {

  /**
   * @private
   */
  static parseActions(fields) {
    const count = Number(String(fields.get("actionCount") ?? "0")
                         .replace(/^"(.*)"$/, "$1"));
    const actions = [];
    for (let i = 0; i < count; i++) {
      const type = fields.get(`action${i}`);
      const value = fields.get(`actionValue${i}`);
      if (type)
        actions.push({
          type: type.replace(/^"(.*)"$/, "$1"),
          value: (value ?? "").replace(/^"(.*)"$/, "$1")
        });
    }
    // Some old or hand-edited files may use unindexed action fields.
    if (!actions.length && fields.has("action")) {
      actions.push({
        type: fields.get("action"),
        value: fields.get("actionValue") ?? ""
      });
    }
    return actions;
  }

  /**
   * @private
   * Split on commas only outside quotes and parentheses.
   */
  static splitConditionParts(input) {
    const parts = [];
    let current = "", quoted = false, escaped = false, depth = 0;
    for (const ch of input) {
      if (escaped) {
        current += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\" && quoted) {
        current += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        quoted = !quoted;
        current += ch;
        continue;
      }
      if (!quoted) {
        if (ch === "(")
          depth++;
        if (ch === ")")
          depth--;
        if (ch === "," && depth === 0) {
          parts.push(current.trim());
          current = "";
          continue;
        }
      }
      current += ch;
    }
    if (current.trim())
      parts.push(current.trim());

    return parts;
  }

  /**
   * @private
   */
  static parseConditions(conditionText = "") {
    // Typical format:
    // AND (from,contains,alice@example.com) (subject,contains,invoice)
    const groups = [];
    const re = /(AND|OR)?\s*\(([^()]*)\)/g;
    let match;
    while ((match = re.exec(conditionText)) !== null) {
      const parts = Rule.splitConditionParts(match[2]);
      if (parts.length >= 3) {
        groups.push({
          join: (match[1] || groups.at(-1)?.join || "AND").toUpperCase(),
          field: parts[0],
          operator: parts[1],
          value: parts.slice(2).join(",").replace(/^"(.*)"$/, "$1")
        });
      }
    }
    return groups;
  }

  /**
   * Construct from a block of text
   * @param {String} block the block of text describing the rule
   */
  constructor(block) {
    const fields = new Map();
    for (const line of block.split("\n")) {
      const m = line.match(/^([A-Za-z][A-Za-z0-9]*)=(.*)$/);
      if (m) fields.set(m[1], m[2]);
    }
    const unquote = value => {
      if (value == null)
        return "";
      const m = value.match(/^"(.*)"$/);
      return m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\") : value;
    };
    this.name = unquote(fields.get("name"));
    //console.debug(`Parsing rule ${this.name}`);
    this.enabled = fields.get("enabled") !== "no";
    this.type = Number(String(fields.get("type") ?? "17")
                       .replace(/^"(.*)"$/, "$1"));
    this.conditions = Rule.parseConditions(unquote(fields.get("condition")));
    this.actions = Rule.parseActions(fields);

    /**
     * The original raw text of the rule.
     */
    this.raw = block;
  }

  /**
   * Extract rules from a msgFilterRules.dat file contents
   * @param {String} text contents of the file
   * @return {Rule[]} list of rules
   */
  static parseRules(text) {
    const blocks = text.replace(/\r\n/g, "\n")
          .split(/(?=^name=)/m)
          .filter(b => /^name=/m.test(b));
    return blocks.map(block => new Rule(block));
  }
}

