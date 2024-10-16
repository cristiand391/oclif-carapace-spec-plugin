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

## Requirements
 * `carapace-spec`: [dowload the binary for your OS]([url](https://github.com/carapace-sh/carapace-spec/releases)) and put it in your `PATH`
 * oclif CLI that supports installing plugins via `plugins install`

## Install

```bash
plugins install @cristiand391/oclif-carapace-spec-plugin
```

Then run the `carapace-gen` command and follow the instructions to source the spec in your shell.

## Why should I use this instead of `@oclif/plugin-autocomplete`?
`@oclif/plugin-autocomplete` only supports bash, zsh and powershell while `carapace-spec` supports those + 6 additional shells: https://carapace-sh.github.io/carapace-spec/carapace-spec/usage.html
Except for flag exclusive relationships, the completion experience is pretty much the same so if you oclif/plugin-autocomplete works for you then you can ignore this.

In the future I plan to add support for injecting custom macros for specific command/flags,see:
https://carapace-sh.github.io/carapace-spec/carapace-spec/macros/core.html

that would allow users to define dynamic completion logic for flag/arg values without having to touch any code.
