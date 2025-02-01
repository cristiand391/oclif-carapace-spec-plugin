oclif-carapace-spec-plugin
=================

An oclif plugin to generate a carapace spec!

`carapace-spec` allows to define CLI completions in a spec file, you can use it to get shell completion in all supported shells listed here:
https://carapace-sh.github.io/carapace-spec/carapace-spec/usage.html


![image](https://github.com/user-attachments/assets/7d6d1ea3-b1fd-4ffe-a67c-399d4e901199)
![image](https://github.com/user-attachments/assets/3e9abd02-9a03-4e76-81c1-1e2f90ded73d)

## Supported features
* Commands
* Flags
  * Options
  * Exclusive relationships
* Re-generate spec automatically on plugin install/uninstall
* Completion overrides (see `Macros` section below)

## Requirements
 * `carapace-spec`: [dowload the binary for your OS]([url](https://github.com/carapace-sh/carapace-spec/releases)) and put it in your `PATH`
 * oclif CLI that supports installing plugins via `plugins install`

## Install

```bash
plugins install @cristiand391/oclif-carapace-spec-plugin
```

Then run the `carapace-gen` command and follow the instructions to source the spec in your shell.

## Macros
`carapace-spec` allows to use macros for customizing completion style and values:

https://carapace-sh.github.io/carapace-spec/carapace-spec/macros.html

You can use macros to define custom flag completion logic for dynamic flag values that can't be hard-coded in CLIs like usernames, IDs, etc.

Macros file example for the Salesforce CLI:
```yaml
# this node applies to all commands, define here completion logic for flags that repeat themselves in multiple commands.
persistentFlagsCompletion:
  target-org: ["$(sf org list auth --json | jq -r '.result[].username')"]
  target-dev-hub: ["$(sf org list auth --json | jq -r '.result[] | select(.isDevHub) | .username')"]
  definition-file: ["$files([.json])"]
  manifest: ["$files([.xml])"]
  file: ["$files"]

# override flag completion for specific commands.
# important: command ids need to separated by colons.
commandOverrides:
  flags:
    'project:deploy:start':
      pre-destructive-changes: ["$files([.xml])"]
      post-destructive-changes: ["$files([.xml])"]
    'org:delete:scratch':
        target-org: ["$(sf org list auth --json | jq -r '.result[] | select(.isScratchOrg) | .username')"]
    'org:delete:sandbox':
        target-org: ["$(sf org list auth --json | jq -r '.result[] | select(.isSandbox) | .username')"]

```

It uses the `exec` macro for `--target-org` and `--target-dev-hub` flags to get completion values from a command, and the `files` macro for XML/JSON file completion on specific flags.

### Usage

1. Define a YAML file with completion definitions like in the example above.
2. Set the `<BIN>_CARAPACE_SPEC_MACROS_FILE` env var to the path to the YAML file.
3. Run `sf carapace-gen --refresh-cache`.

> [!NOTE]  
This plugin re-generates the carapace spec everytime you install/uninstall plugins via `plugins install/uninstall`, make sure to set the `<BIN>_CARAPACE_SPEC_MACROS_FILE` env var in your shell RC file so that you don't miss the custom completions when the automatic re-generation happens under the hood.


## Why should I use this instead of `@oclif/plugin-autocomplete`?
`@oclif/plugin-autocomplete` only supports bash, zsh and powershell while `carapace-spec` supports those + 6 additional shells: https://carapace-sh.github.io/carapace-spec/carapace-spec/usage.html

Except for flag exclusive relationships and completion overrides (macros), the completion experience is pretty much the same so if `oclif/plugin-autocomplete` works for you then you can ignore this.
