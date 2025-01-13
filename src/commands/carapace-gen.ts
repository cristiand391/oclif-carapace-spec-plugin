import {Command, Flags, Interfaces} from '@oclif/core'
import {bold,cyan} from 'ansis'
import * as ejs from 'ejs'
import {mkdir,writeFile,readFile} from 'node:fs/promises'
import YAML, { YAMLMap } from 'yaml'

type YamlCommandNode = {
  name: string;
  description: string;
  commands: YamlCommandNode[]
}

type CommandNode = {
  flags?: {[name: string]: Command.Flag.Cached}
  id: string
  summary: string
}

type TopicNode = {
  id: string
  summary: string
}

type Node = CommandNode | TopicNode

type Macros = {
  persistentFlagsCompletion?: {
    [name: string]: string[];
  };
  commandOverrides?: {
    flags?: {
      [name: string]: {
        [name: string]: string[];
      };
    };
  };
};

export default class CarapaceGen extends Command {
  static override description = `Generate a carapace spec file

Use \`carapace-gen\` to get shell completion:
https://github.com/carapace-sh/carapace-spec`

  static flags = {
    'refresh-cache': Flags.boolean({char: 'r', summary: 'Refresh cache (ignores displaying instructions)'}),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(CarapaceGen)

    const { bin, cacheDir } = this.config

    const specPath = `${cacheDir}/oclif-carapace-spec/${bin}.yml`

    await mkdir(`${cacheDir}/oclif-carapace-spec`, {
      recursive: true
    })

    const commandNodes = this.getCommandNodes()

    const macrosFilepath = process.env['OCLIF_CARAPACE_SPEC_MACROS_FILE']
    const macros = macrosFilepath ? YAML.parse(await readFile(macrosFilepath, 'utf8')) : undefined

    await writeFile(specPath, YAML.stringify(this.buildCommandTree(commandNodes, macros), {
      // avoid using YAML anchors in completion file, carapace doesn't like them.
      aliasDuplicateObjects: false
    }))

    if (!flags['refresh-cache']) {
      this.log(`
1) Source the following spec file in your shell profile:

  ${cyan(specPath)}

  ${bold('Instructions for supported shells by carapace-gen:')}
  https://carapace-sh.github.io/carapace-spec/carapace-spec/usage.html

2) Start using autocomplete

  ${cyan(`${bin} <TAB>`)}              ## Command completion
  ${cyan(`${bin} command --<TAB>`)}    ## Flag completion
`)
    }
  }
  
  private buildCommandTree(nodes: Node[], macros: Macros | undefined) {
    const commandTree: {
      name: string,
      description: string;
      commands: YamlCommandNode[]
    } = { name: this.config.bin, description: this.config.pjson.description ?? `${this.config.bin} CLI`,commands: []  };

    for (const node of nodes) {
      const parts = node.id.split(':')
      let currentLevel = commandTree.commands;

      // Traverse or create the command hierarchy
      for (const part of parts) {
        // Check if the command already exists at this level
        let existingCommand = currentLevel.find(cmd => cmd.name === part);

        const isCommand = "flags" in node

        let flags: YAMLMap | undefined

        const completion: {
          flag: { [key: string]: string[] }
        } = {
          flag: {}
        }
        let hasFlagValueCompletion = false

        const exclusiveflags: string[][] = []
        
        if (isCommand) {
          flags= new YAMLMap()

          let hasHelpFlag = false;

          for (const flagName in node.flags) {
            const flag = node.flags[flagName]

            if (flag.deprecated || flag.hidden) continue

            if (node.flags[flagName].exclusive) {
              const exclusives = node.flags[flagName].exclusive.filter(flag => {
                // @ts-ignore
                return node.flags[flag] && !node.flags[flag].hidden
              })

              if (exclusives.length === 0) continue

              // avoid duplicate `exclusiveflags` arrays
              // this can happen if 2 or more flags define the same exclusions.
              const sortedFlagExclusives = [...exclusives, flagName].sort()
              const alreadyExists = exclusiveflags.find(exclusive => exclusive.toString() === sortedFlagExclusives.toString())

              if (!alreadyExists) {
                exclusiveflags.push(sortedFlagExclusives)
              }
            }


            // check if `--help` is already taken by the command, carapace-spec panics on duplicated flags
            if (!hasHelpFlag) {
              hasHelpFlag = flagName === 'help'
            }

            let flagDef = flag.char ? `-${flag.char}, --${flagName}` : `--${flagName}`

            // See flag modifiers:
            // https://carapace-sh.github.io/carapace-spec/carapace-spec/command/flags.html
            if (flag.type === "option") {
              flagDef += flag.multiple ? '*=' : '='

              if (flag.options) {
                completion.flag[flagName] = [...flag.options] 
                hasFlagValueCompletion = true
              }
            }

            flags.add({
              key: flagDef,
              value: node.flags[flagName].summary ?? node.flags[flagName].description ?? ''
            })

            if (macros) {
              if (macros.persistentFlagsCompletion && Object.hasOwn(macros.persistentFlagsCompletion, flagName)) {
                completion.flag[flagName] = macros.persistentFlagsCompletion[flagName]
                hasFlagValueCompletion = true
              }
              if (macros.commandOverrides?.flags && Object.hasOwn(macros.commandOverrides.flags, node.id)) {
                if (Object.hasOwn(macros.commandOverrides.flags[node.id], flagName)) {
                  completion.flag[flagName] = macros.commandOverrides.flags[node.id][flagName]
                  hasFlagValueCompletion = true
                }
              }
            }
            
          }

          // add oclif's global help flag
          if (!hasHelpFlag) {
            flags.add({
              key: '--help',
              value: 'Show help for command'
            })
          }
        }

        // if on last part of the node and the existing node is a topic,
        // then the current node is a cotopic (topic that's also a command).
        //
        // In these cases we want to modify the cotopic node to:
        // 1. prefer the command's summary over the topic one
        // 2. add the command's flags
        // 3. add the topic's command
        if (part === parts[parts.length - 1] && existingCommand && !('flags' in existingCommand)) {
          const existingCommandIdx = currentLevel.findIndex(cmd => cmd.name === part);

          existingCommand = {
            description: node.summary,
            name: part,
            ...(isCommand ? {flags}: {}),
            ...((isCommand && hasFlagValueCompletion ) ? { completion } : {}),
            ...((isCommand && exclusiveflags.length > 0 ) ? { exclusiveflags } : {}),
            commands: existingCommand.commands
          }

          currentLevel[existingCommandIdx] = existingCommand
        } else if (!existingCommand) {
          // Create a new command entry
          existingCommand = {
            description: node.summary,
            name: part,
            ...(isCommand ? {flags}: {}),
            ...((isCommand && exclusiveflags.length > 0 ) ? { exclusiveflags } : {}),
            ...((isCommand && hasFlagValueCompletion )? { completion } : {}),
            commands: []
          };
          currentLevel.push(existingCommand);
        }

        // Move down to the next level of commands
        currentLevel = existingCommand.commands;
      }
    }

    return commandTree;
  }

  private getCommandNodes(): Node[] {
    const nodes: Node[] = []

    // Important:
    // Topic nodes need to be added before command ones.
    // 
    // When creating a command tree we pass the whole node array,
    // having the topic nodes first ensures their help text matches what's defined
    // in the plugin's pjson (descriptions in `oclif.topics`)
    for (const t of this.getTopics()) {
      nodes.push({
        id: t.id,
        summary: t.summary
      })
    }

    for (const plugin of this.config.getPluginsList()) {
      for (const cmd of plugin.commands) {
        if (cmd.state === 'deprecated' ||  cmd.hidden) continue

        const summary = this.sanitizeSummary(cmd.summary ?? cmd.description)
        const {flags} = cmd

        nodes.push({
          flags,
          id: cmd.id,
          summary,
        })

        // also include non-deprecated aliases
        if (!cmd.deprecateAliases) {
          for (const alias of cmd.aliases) { 
            nodes.push({
              flags,
              id: alias,
              summary,
            })

            const split = alias.split(':')

            let topic = split[0]

            // Command nodes are generated from topics:
            // `force` -> `force:org` -> `force:org:open|list`
            //
            // but aliases aren't guaranteed to follow the plugin command tree
            // so we need to add any missing topic between the starting point and the alias.
            for (let i = 0; i < split.length - 1; i++) {
              if (!(this.getTopics()).some((t) => t.id === topic)) {
                nodes.push({
                  flags: {},
                  id: topic,
                  summary: 'topic help'
                })
              }

              topic += `:${split[i + 1]}`
            }
          }
        }
      }
    } 

    return nodes
  }

  private getTopics(): TopicNode[] {
    const topics = this.config.topics
      .filter((topic: Interfaces.Topic) => {
        // it is assumed a topic has a child if it has children
        const hasChild = this.config.topics.some((subTopic) => subTopic.name.includes(`${topic.name}:`))
        return hasChild
      })
      .sort((a, b) => {
        if (a.name < b.name) {
          return -1
        }

        if (a.name > b.name) {
          return 1
        }

        return 0
      })
      .map((t) => {
        const summary = t.description
          ? this.sanitizeSummary(t.description)
          : `${t.name.replaceAll(':', ' ')} commands`

        return {
          id: t.name,
          summary,
        }
      })

    return topics
  }

  private sanitizeSummary(summary?: string): string {
    if (summary === undefined) {
      return ''
    }

    return ejs
      .render(summary, {config: this.config})
      .replaceAll(/(["`])/g, '\\\\\\$1') // backticks and double-quotes require triple-backslashes

      .replaceAll(/([[\]])/g, '\\\\$1') // square brackets require double-backslashes
      .split('\n')[0] // only use the first line
  }
}
