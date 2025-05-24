import {Command} from '@oclif/core'
import {YAMLMap} from 'yaml'

type YamlCommandNode = {
  name: string;
  description: string;
  commands: YamlCommandNode[];
  flags?: YAMLMap;
  completion?: {
    flag: { [key: string]: string[] }
  };
  exclusiveflags?: string[][];
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

export type CommandTree = {
  name: string;
  description: string;
  commands: YamlCommandNode[];
}

export function buildCommandTree(nodes: Node[], macros: Macros | undefined, bin: string, description: string): CommandTree {
  const commandTree: CommandTree = { 
    name: bin, 
    description: description, 
    commands: [] 
  };

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
        flags = new YAMLMap()

        let hasHelpFlag = false;

        for (const flagName in node.flags) {
          const flag = node.flags[flagName]

          if (flag.deprecated || flag.hidden) continue

          if (node.flags[flagName].exclusive) {
            const exclusives = node.flags[flagName].exclusive.filter(flag => {
              // @ts-ignore
              return node.flags[flag] && !node.flags[flag].hidden && !node.flags[flag].deprecated
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
