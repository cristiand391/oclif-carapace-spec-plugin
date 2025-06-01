import {Hook} from '@oclif/core'

const hook: Hook<'refresh'> = async function (opts) {
  // TODO: ask Mike if we could update the plugins:postinstall hook to pass the info about the plugin being installed like in the preinstall hook:
  // https://github.com/oclif/plugin-plugins/blob/763a2fc6f742048f251f4cadc89dde31fb003b28/src/commands/plugins/install.ts#L194
  // https://github.com/oclif/plugin-plugins/blob/763a2fc6f742048f251f4cadc89dde31fb003b28/src/commands/plugins/install.ts#L172
  //
  // if so, we could remove this `get` call and skip the refresh if this plugin is being installed.
  if (opts.config.plugins.get('@cristiand391/oclif-carapace-spec-plugin')) {
    // this `config` instance already have installed/uninstalled plugins loaded
    await opts.config.runCommand('carapace-gen', ['--refresh-cache'])
  }
}

export default hook
