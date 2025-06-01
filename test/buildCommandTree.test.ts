import {test} from 'node:test'
import {buildCommandTree} from '../src/utils/buildCommandTree.js'
import {YAMLMap} from 'yaml'
import assert from 'node:assert'

test('buildCommandTree', async (t) => {
  await t.test('should create a basic command tree', () => {
    const nodes = [{
      id: 'test',
      summary: 'Test command',
      flags: {
        help: {
          type: 'boolean',
          char: 'h',
          description: 'Show help for command',
          hidden: false,
          required: false,
          default: false,
          exclusive: [],
        }
      }
    }]

    const result = buildCommandTree(nodes, undefined, 'test-cli', 'Test CLI')
    
    assert.strictEqual(result.name, 'test-cli')
    assert.strictEqual(result.description, 'Test CLI')
    assert.strictEqual(result.commands.length, 1)
    assert.strictEqual(result.commands[0].name, 'test')
    assert.strictEqual(result.commands[0].description, 'Test command')
    assert(result.commands[0].flags instanceof YAMLMap)
  })

  await t.test('should handle nested commands', () => {
    const nodes = [
      {
        id: 'parent',
        summary: 'Parent command',
        flags: {}
      },
      {
        id: 'parent:child',
        summary: 'Child command',
        flags: {}
      }
    ]

    const result = buildCommandTree(nodes, undefined, 'test-cli', 'Test CLI')
    
    assert.strictEqual(result.commands.length, 1)
    assert.strictEqual(result.commands[0].name, 'parent')
    assert.strictEqual(result.commands[0].commands.length, 1)
    assert.strictEqual(result.commands[0].commands[0].name, 'child')
  })

  await t.test('should handle flag relationships', () => {
    const nodes = [{
      id: 'test',
      summary: 'Test command',
      flags: {
        flag1: {
          type: 'boolean',
          description: 'Flag 1',
          exclusive: ['flag2'],
        },
        flag2: {
          type: 'boolean',
          description: 'Flag 2',
          exclusive: ['flag1'],
        }
      }
    }]

    const result = buildCommandTree(nodes, undefined, 'test-cli', 'Test CLI')
    
    assert.deepStrictEqual(result.commands[0].exclusiveflags, [['flag1', 'flag2']])
  })

  await t.test('should handle flag modifiers', () => {
    const nodes = [{
      id: 'test',
      summary: 'Test command',
      flags: {
        stringFlag: {
          type: 'option',
          description: 'String flag',
          multiple: true,
        },
        boolFlag: {
          type: 'boolean',
          description: 'Boolean flag',
        }
      }
    }]

    const result = buildCommandTree(nodes, undefined, 'test-cli', 'Test CLI')
    const flags = result.commands[0].flags as YAMLMap
    
    assert.strictEqual(flags.get('--stringFlag*='), 'String flag')
    assert.strictEqual(flags.get('--boolFlag'), 'Boolean flag')
  })

  await t.test('should handle flag completion', () => {
    const nodes = [{
      id: 'test',
      summary: 'Test command',
      flags: {
        enumFlag: {
          type: 'option',
          description: 'Enum flag',
          options: ['option1', 'option2', 'option3'],
        }
      }
    }]

    const result = buildCommandTree(nodes, undefined, 'test-cli', 'Test CLI')
    
    assert.deepStrictEqual(result.commands[0].completion?.flag.enumFlag, ['option1', 'option2', 'option3'])
  })

  await t.test('should handle macros for flag completion', () => {
    const nodes = [{
      id: 'test',
      summary: 'Test command',
      flags: {
        customFlag: {
          type: 'option',
          description: 'Custom flag',
        }
      }
    }]

    const macros = {
      persistentFlagsCompletion: {
        customFlag: ['value1', 'value2']
      }
    }

    const result = buildCommandTree(nodes, macros, 'test-cli', 'Test CLI')
    
    assert.deepStrictEqual(result.commands[0].completion?.flag.customFlag, ['value1', 'value2'])
  })

  await t.test('should handle command overrides in macros', () => {
    const nodes = [{
      id: 'test',
      summary: 'Test command',
      flags: {
        customFlag: {
          type: 'option',
          description: 'Custom flag',
        }
      }
    }]

    const macros = {
      commandOverrides: {
        flags: {
          'test': {
            customFlag: ['override1', 'override2']
          }
        }
      }
    }

    const result = buildCommandTree(nodes, macros, 'test-cli', 'Test CLI')
    
    assert.deepStrictEqual(result.commands[0].completion?.flag.customFlag, ['override1', 'override2'])
  })

  await t.test('should handle deprecated and hidden flags', () => {
    const nodes = [{
      id: 'test',
      summary: 'Test command',
      flags: {
        deprecatedFlag: {
          type: 'boolean',
          description: 'Deprecated flag',
          deprecated: true,
        },
        hiddenFlag: {
          type: 'boolean',
          description: 'Hidden flag',
          hidden: true,
        },
        visibleFlag: {
          type: 'boolean',
          description: 'Visible flag',
        }
      }
    }]

    const result = buildCommandTree(nodes, undefined, 'test-cli', 'Test CLI')
    const flags = result.commands[0].flags as YAMLMap
    
    assert.strictEqual(flags.get('--deprecatedFlag'), undefined)
    assert.strictEqual(flags.get('--hiddenFlag'), undefined)
    assert.strictEqual(flags.get('--visibleFlag'), 'Visible flag')
  })

  await t.test('should handle help flag correctly', () => {
    const nodes = [{
      id: 'test',
      summary: 'Test command',
      flags: {
        help: {
          type: 'boolean',
          description: 'Custom help flag',
        }
      }
    }]

    const result = buildCommandTree(nodes, undefined, 'test-cli', 'Test CLI')
    const flags = result.commands[0].flags as YAMLMap
    
    assert.strictEqual(flags.get('--help'), 'Custom help flag')
  })

  await t.test('should add help flag if not present', () => {
    const nodes = [{
      id: 'test',
      summary: 'Test command',
      flags: {}
    }]

    const result = buildCommandTree(nodes, undefined, 'test-cli', 'Test CLI')
    const flags = result.commands[0].flags as YAMLMap
    
    assert.strictEqual(flags.get('--help'), 'Show help for command')
  })
}) 
