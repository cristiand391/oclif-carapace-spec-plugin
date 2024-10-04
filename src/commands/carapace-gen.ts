import {Command, Flags, Interfaces} from '@oclif/core'
import {bold,cyan} from 'ansis'
import * as ejs from 'ejs'
import {mkdir,writeFile} from 'node:fs/promises'
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

    await writeFile(specPath, YAML.stringify(this.buildCommandTree(commandNodes)))

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
  
  private buildCommandTree(nodes: Node[]) {
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
        
        if (isCommand) {
          flags= new YAMLMap()

          for (const flagName in node.flags) {
            const flag = node.flags[flagName]

            if (flag.deprecated || flag.hidden) continue

            let flagDef = flag.char ? `-${flag.char}, --${flagName}` : `--${flagName}`
            if (flag.type === "option" && flag.multiple) {
              flagDef += "*"
            }

            flags.add({
              key: flagDef,
              value: node.flags[flagName].summary ?? node.flags[flagName].description ?? ''
            })
          }
        }

        if (!existingCommand) {
          // Create a new command entry
          existingCommand = {
            description: node.summary,
            name: part,
            ...(isCommand ? {flags}: {}),
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
