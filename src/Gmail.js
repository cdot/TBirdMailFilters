const ATOM_NS = "http://www.w3.org/2005/Atom";
const APPS_NS = "http://schemas.google.com/apps/2006";

const fieldMap = {
  from: "from", to: "to", cc: "cc", bcc: "bcc",
  subject: "subject", body: "query", "body,": "query",
  "to or cc": "to", "sender": "from", "recipient": "to",
  "\"envelope-to\"": "to", "\"x-original-recipient\"": "to"
};

function escapeXml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;"
    })[char]);
}

/**
 * Support for conversion from a normalised rule to a rule that can
 * be imported to Gmail.
 */
export class Gmail {

  /**
   * Convert a normalised rule condition to a Gmail query, as best you can.
   */
  conditionToQuery(c) {
    const normf = c.field.toLowerCase();

    function quoteQuery(value) {
      const v = String(value).trim();
      return /[\s(){}"]/u.test(v) ? `"${v.replace(/(["\\])/g, "\\$1")}"` : v;
    }

    if (normf === "all addresses") {
      let terms = [];
      for (const f of [ 'from', 'to', 'cc', 'bcc' ]) {
        c.field = f;
        terms.push(this.conditionToQuery(c));
      }
      c.field = "all addresses";
      return `(${terms.join(" OR ")})`;
    }
    
    const field = fieldMap[normf];
    const value = quoteQuery(c.value);
    if (!field) {
      this.warnings.push(`${this.name}: Unsupported condition field "${c.field}" (${c.operator}); skipped.`);
      return null;
    }
    const op = c.operator.toLowerCase();
    const negated = op.startsWith("doesn't")
          || op.startsWith("does not")
          || op.startsWith("isn't")
          || op === "isnt";
    
    let term;
    if (field === "query")
      term = value;
    else
      term = `${field}:${value}`;
    if (negated)
      term = `-${term}`;
    
    if ([ "contains", "is", "begins with", "ends with", "isn't",
          "is not", "doesn't contain", "does not contain"].includes(op)) {
      if (op === "begins with" || op === "ends with" || op === "is") {
        this.warnings.push(`${this.name}: Gmail search cannot exactly preserve Thunderbird operator "${c.operator}" for ${c.field}; using a contains-style search.`);
      }
      return term;
    }
    
    if (op.includes("is empty"))
      return `-${field}:*`;
    
    if (op.includes("isn't empty") || op.includes("is not empty"))
      return `${field}:*`;
    
    this.warnings.push(`${this.name}: Unsupported condition operator "${c.operator}" for ${c.field}; skipped.`);
    
    return null;
  }

  
  /**
   * Construct from a normalised rule
   * @param {Rule} rule the rule to convert
   */
  constructor(rule) {
    this.warnings = [];
    this.name = rule.name;
    this.enabled = rule.enabled;

    const terms = [];
    let previousJoin = "AND";
    for (const c of rule.conditions) {
      const term = this.conditionToQuery(c);
      if (!term) continue;
      if (terms.length && c.join === "OR")
        terms.push("OR");
      terms.push(term);
      previousJoin = c.join;
    }

    this.criteria = { query: terms.join(" ").replace(/\s+OR\s+/g, " OR ") };

    const action = { addLabelIds: [], removeLabelIds: [] };
    this.labelName = null;
    for (const a of rule.actions) {
      const type = String(a.type).toLowerCase().replace(/^"(.*)"$/, "$1");
      const value = String(a.value).replace(/^"(.*)"$/, "$1");

      switch (type) {
      case "movetofolder":
      case "cop tomfolder":
      case "copytofolder":
      case "move to folder":
        this.labelName = value.split("/").filter(Boolean).at(-1) || value;
        if (type === "movetofolder") action.removeLabelIds.push("INBOX");
        break;
      case "markread": action.removeLabelIds.push("UNREAD"); break;
      case "markunread": action.addLabelIds.push("UNREAD"); break;
      case "star":
      case "addflag": action.addLabelIds.push("STARRED"); break;
      case "delete": action.addLabelIds.push("TRASH"); break;
      case "ignorethread":
      case "stopexecution":
        this.warnings.push(`${this.name}: Thunderbird action "${a.type}" has no Gmail filter equivalent; ignored.`);
      default:
        this.warnings.push(`${this.name}: Unsupported Thunderbird action ${a.type} ignored.`);
      }
    }
    this.action = action;
  }

  /**
   * Export to Gmail's filter XML format.
   * @returns {string} Gmail filter XML.
   */
  toXML() {
    function property(name, value) {
      if (value === undefined || value === null || value === "")
        return "";
      return `    <apps:property name="${escapeXml(name)}" value="${escapeXml(value)}"/>`;
    }

    // Gmail should not receive disabled rules or empty search criteria.
    if (!this.enabled || !this.criteria?.query)
      return null;
    
    const properties = [];
    
    // Gmail's search query represents the translated conditions.
    properties.push(property("hasTheWord", this.criteria.query));
    
    const add = new Set(this.action?.addLabelIds ?? []);
    const remove = new Set(this.action?.removeLabelIds ?? []);
    
    // Translate supported Thunderbird actions.
    if (remove.has("INBOX")) {
      properties.push(property("shouldArchive", "true"));
    }
    
    if (remove.has("UNREAD")) {
      properties.push(property("shouldMarkAsRead", "true"));
    }
    
    if (add.has("UNREAD")) {
      properties.push(property("shouldMarkAsUnread", "true"));
    }
    
    if (add.has("STARRED")) {
      properties.push(property("shouldStar", "true"));
    }
    
    if (add.has("TRASH")) {
      properties.push(property("shouldTrash", "true"));
    }
    
    if (this.labelName) {
      properties.push(property("label", this.labelName));
    }
    
    return [
      "  <entry>",
      '    <category term="filter"/>',
      "    <title>Mail Filter</title>",
      "    <content/>",
      ...properties.filter(Boolean),
      "  </entry>",
    ].join("\n");
  }

  /**
   * Generate XML for a set of rules.
   * @param {Array.<Gmail>} rules Rules in Gmail form
   * @param {Object} options Export options.
   * @param {string} options.email Email address for the Atom author.
   * @param {string} options.updated ISO 8601 timestamp.
   * @return {String} XML for the converted rules. Conversion may generate
   * warnings which are retained in the `warnings` field of the Gmail.
   */
  static rules2XML(
    rules,
    {
      email = "",
      updated = new Date().toISOString()
    } = {}) {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<feed xmlns="${ATOM_NS}" xmlns:apps="${APPS_NS}">`,
      "  <title>Mail Filters</title>",
      "  <id>tag:mail.google.com,2008:filters:tbfilters2gmail-js</id>",
      `  <updated>${escapeXml(updated)}</updated>`,
      "  <author>",
      "    <name>Filters from Thunderbird</name>",
      `    <email>${escapeXml(email)}</email>`,
      "  </author>",
      ...rules.map(r => r.toXML()),
      "</feed>",
      "",
    ].join("\n");
  }
}
