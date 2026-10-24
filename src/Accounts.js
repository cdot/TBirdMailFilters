export class Accounts {

  constructor(js) {
    const prefs = {};

    function user_pref(prefname, value) {
      const keys = prefname.split(".");
      let level = prefs;
      while (keys.length > 1) {
        const key = keys.shift();
        if (!level[key])
          level[key] = {};
        else if (typeof level[key] !== "object") {
          throw new Error(`Problem at ${prefname}`);
        }
        level = level[key];
      }
      level[keys[0]] = value;
    }

    eval(js);
    for (const server of Object.values(prefs.mail.server)) {
      this[server.name] = server.directory;
    }
  }
}
