export class Profiles {
  constructor(text) {
    let profile;
    
    const addProfile = profile => {
      if (profile.Name && profile.Path)
        this[profile.Name] = profile.Path;
      else if (/^\[Install/.test(profile.ID) && profile.Default) {
        this.Default = profile.Default;
      }
    };

    for (const line of text.split(/[\n\r]+/)) {
      if (line[0] === "[") {
        if (profile)
          addProfile(profile);
        profile = { ID: line };
      } else if (profile) {
        const bits = line.split("=");
        if (bits.length === 2) {
          profile[bits[0]] = bits[1];
        }
      }
    }
    if (profile)
      addProfile(profile);
  }
}
