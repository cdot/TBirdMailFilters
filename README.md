# TBirdMailFilters

Explore Thunderbird mail filters, and export subsets in `msgFilterRules.dat`
format and/or map to Gmail format filters. 

The primary application is for sharing mail filters between multiple Thunderbird installations (e.g. Desktop, Laptop, Phone), and also for exporting filters to Gmail.

## Requirements

- Node.js 20+
- A Thunderbird install

## Install

```sh
npm install
```

## Get help on the options.
```sh
npm start -- --help
```

## Tell the the program where Thunderbird data files are
You can also define an environment variable `TBIRD_INSTALL`. Shouldn't be needed on Linux.
```sh
npm start -- --tbird 'C:\Users\YourUserName\AppData\Roaming\Thunderbird'
```
Thunderbird data directories are normally found in:
- Linux `~/.thunderbird`
- Windows `'C:\Users\YourUserName\AppData\Roaming\Thunderbird`
- MacOS
  - Open Finder.
  - Hold down the Option key and click Go in the top menu bar.
  - Select Library.
  - Navigate to Application Support -> Thunderbird -> Profiles.

## Get a list of the profiles in the current Thunderbird installation
```sh
npm start -- -Profiles
```

## Get a list of mail accounts in a profile.
`--profile` isn't needed if you want the default profile.
```sh
npm start -- --profile "w178654.default" -Accounts
```

## Get a list of filter rules
For a specific account in the default profile.
```sh
npm start -- --account "dinsdale@hedgehog.com" --Rules
```

## Select a subset of rules and write a new msgFilterRules.dat
```sh
npm start -- --account "me@gmail.com" --rules "SPAM,Lloyds Bank" -c msgFilterRules.dat
```

## Generate XML for manual import of rules to Gmail
```sh
npm start -- --account "me@gmail.com" --gmail gmailRules.xml
```

Thunderbird's condition/action formats and Gmail's search syntax are quite different. Unsupported conditions/actions are reported, and mappings for `begins with`, `ends with`, and `is exactly` are necessarily approximate. Validate the generated filters manually before loading them into Gmail.

## Develop

Tests are run by
```sh
npm test
```
