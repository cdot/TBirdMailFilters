# TBirdMailFilters

Explore Thunderbird mail filters, and export subsets in `msgFilterRules.dat`
format and/or map to Gmail format filters. 

The primary application is for sharing mail filters between multiple Thunderbird installations (e.g. Desktop, Laptop, Phone), and also for exporting filters to Gmail.

## Requirements

- Node.js 20+

## Install

```sh
npm install
```

## Explore what's there

Get help on the options.
```sh
npm start -- --help
```

Tell the the program where Thunderbird data files are. You can also define an environment variable `TBIRD_INSTALL`. Shouldn't be needed on Linux.
```sh
npm start -- --tbird 'C:\Users\YourUserName\AppData\Roaming\Thunderbird'
```

Get a list of the profiles in the current Thunderbird installation.
```sh
npm start -- -Profiles
```

Get a list of mail accounts in a profile. `--profile` isn't needed if you want the default profile.
```sh
npm start -- --profile "w178654.default" -Accounts
```

Get a list of filter rules for a specific account in the default profile.
```sh
npm start -- --account "Local Folders" --Rules
```

## Select a subset of rules for creating a new msgFilterRules.dat
```sh
npm start -- --account "me@gmail.com" --rules "SPAM,Lloyds Bank" -c msgFilterRules.dat
```

## Generate XML for manual import of rules to Gmail
```sh
npm start -- --account "me@gmail.com" --gmail gmailRules.xml
```

Thunderbird's condition/action formats and Gmail's search syntax are quite different. Unsupported conditions/actions are reported, and mappings for `begins with`, `ends with`, and `is exactly` are necessarily approximate. Validate the generated filters manually before loading them into Gmail.

## Develop

Tests are run by `node --test` in the root directory.
