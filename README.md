# TBirdMailFilters

Explore Thunderbird mail filters, and export subsets in `msgFilterRules.dat`
format and/or map to Gmail format filters.

## Requirements

- Node.js 20+

## Install

```sh
npm install
```

## Explore what's there

```sh
npm start -- --help
npm start -- -Profiles
npm start -- -Accounts
npm start -- --profile "w178654.default" --account "Local Folders" --Rules
```

## Generate XML for manual import of rules to Gmail
```sh
npm start -- --account "Local Folders" --gmail gmailRules.xml
```

Thunderbird's condition/action formats and Gmail's search syntax differ. Unsupported conditions/actions are reported, and mappings for `begins with`, `ends with`, and `is exactly` are necessarily approximate. Validate the generated filters manually before applying.

## Develop

Tests are run by `node --test` in the root directory.
