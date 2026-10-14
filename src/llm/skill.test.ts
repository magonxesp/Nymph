import { describe, expect, it } from 'vitest'
import { Skill, parseSkill } from './skill.js'

const validFrontmatter = {
    name: 'example-skill',
    description: 'Processes examples. Use when working with example files.'
}

describe('Skill frontmatter', () => {
    it('keeps the raw Markdown content passed to the constructor', () => {
        const content = '# Example Skill\n\nFollow these instructions.\n'
        const skill = new Skill(validFrontmatter, content)

        expect(skill.content).toBe(content)
    })

    describe('frontmatter object', () => {
        it.each([
            ['missing', undefined],
            ['null', null],
            ['string', 'name: example-skill'],
            ['number', 123],
            ['array', [validFrontmatter]]
        ])('rejects a %s frontmatter', (_case, frontmatter) => {
            expect(() => new Skill(frontmatter)).toThrow()
        })
    })

    describe('name', () => {
        it('rejects a missing name', () => {
            expect(() => new Skill({ description: validFrontmatter.description })).toThrow()
        })

        it.each([
            ['one character', 'a'],
            ['letters, numbers and hyphens', 'example-skill2'],
            ['64 characters', 'a'.repeat(64)]
        ])('accepts %s', (_case, name) => {
            const skill = new Skill({ ...validFrontmatter, name })
            expect(skill.name).toBe(name)
        })

        it.each([
            ['undefined', { name: undefined }],
            ['null', { name: null }],
            ['number', { name: 123 }],
            ['array', { name: ['example-skill'] }],
            ['empty', { name: '' }],
            ['more than 64 characters', { name: 'a'.repeat(65) }],
            ['uppercase letters', { name: 'Example' }],
            ['underscores', { name: 'example_skill' }],
            ['spaces', { name: 'example skill' }],
            ['non-ASCII letters', { name: 'éxample' }],
            ['leading hyphen', { name: '-example' }],
            ['trailing hyphen', { name: 'example-' }],
            ['consecutive hyphens', { name: 'example--skill' }]
        ])('rejects %s', (_case, invalidName) => {
            expect(() => new Skill({ ...validFrontmatter, ...invalidName })).toThrow()
        })
    })

    describe('description', () => {
        it.each([
            ['one character', 'a'],
            ['1024 characters', 'a'.repeat(1024)]
        ])('accepts %s', (_case, description) => {
            const skill = new Skill({ ...validFrontmatter, description })
            expect(skill).toBeInstanceOf(Skill)
        })

        it.each([
            ['missing', {}],
            ['undefined', { description: undefined }],
            ['null', { description: null }],
            ['number', { description: 123 }],
            ['array', { description: ['Processes examples'] }],
            ['empty', { description: '' }],
            ['more than 1024 characters', { description: 'a'.repeat(1025) }]
        ])('rejects %s', (_case, invalidDescription) => {
            expect(() => new Skill({ name: validFrontmatter.name, ...invalidDescription })).toThrow()
        })
    })

    describe('optional fields', () => {
        it('returns undefined for omitted fields', () => {
            const skill = new Skill(validFrontmatter)

            expect(skill.license).toBeUndefined()
            expect(skill.compatibility).toBeUndefined()
            expect(skill.metadata).toBeUndefined()
            expect(skill.allowedTools).toBeUndefined()
        })

        it('accepts valid values', () => {
            const skill = new Skill({
                ...validFrontmatter,
                license: 'Apache-2.0',
                compatibility: 'Requires git',
                metadata: { author: 'example-author' },
                'allowed-tools': 'Bash(git:*) Read'
            })

            expect(skill.description).toBe(validFrontmatter.description)
            expect(skill.license).toBe('Apache-2.0')
            expect(skill.compatibility).toBe('Requires git')
            expect(skill.metadata).toEqual({ author: 'example-author' })
            expect(skill.allowedTools).toBe('Bash(git:*) Read')
        })

        it.each([
            ['empty', ''],
            ['more than 500 characters', 'a'.repeat(501)],
            ['number', 123],
            ['array', ['Requires git']]
        ])('rejects %s compatibility', (_case, compatibility) => {
            expect(() => new Skill({ ...validFrontmatter, compatibility })).toThrow()
        })

        it.each([
            ['number', 123],
            ['array', ['Apache-2.0']]
        ])('rejects a %s license', (_case, license) => {
            expect(() => new Skill({ ...validFrontmatter, license })).toThrow()
        })

        it.each([
            ['string', 'author: example-author'],
            ['array', ['example-author']],
            ['non-string key value', { author: 123 }],
            ['nested object value', { author: { name: 'example-author' } }]
        ])('rejects %s metadata', (_case, metadata) => {
            expect(() => new Skill({ ...validFrontmatter, metadata })).toThrow()
        })

        it.each([
            ['number', 123],
            ['array', ['Read']]
        ])('rejects %s allowed-tools', (_case, allowedTools) => {
            expect(() => new Skill({ ...validFrontmatter, 'allowed-tools': allowedTools })).toThrow()
        })
    })
})

describe('parseSkill', () => {
    it('parses required frontmatter fields before Markdown instructions', () => {
        const markdown = `---
name: example-skill
description: Processes examples. Use when working with example files.
---

# Example Skill

Follow these instructions.`

        const skill = parseSkill(markdown)

        expect(skill).toBeInstanceOf(Skill)
        expect(skill.name).toBe('example-skill')
        expect(skill.description).toBe(validFrontmatter.description)
        expect(skill.content).toBe('\n# Example Skill\n\nFollow these instructions.')
    })

    it('preserves the body with its original line endings', () => {
        const markdown = '---\r\nname: example-skill\r\ndescription: Processes examples.\r\n---\r\n\r\n# Example Skill\r\n'

        const skill = parseSkill(markdown)

        expect(skill.content).toBe('\r\n# Example Skill\r\n')
    })

    it('parses optional fields and nested metadata', () => {
        const markdown = `---
name: example-skill
description: Processes examples. Use when working with example files.
license: Apache-2.0
compatibility: Requires git
metadata:
  author: example-author
  version: "1.0"
allowed-tools: Bash(git:*) Read
---

# Example Skill`

        const skill = parseSkill(markdown)

        expect(skill.license).toBe('Apache-2.0')
        expect(skill.compatibility).toBe('Requires git')
        expect(skill.metadata).toEqual({ author: 'example-author', version: '1.0' })
        expect(skill.allowedTools).toBe('Bash(git:*) Read')
    })

    it('parses a folded YAML description', () => {
        const markdown = `---
name: example-skill
description: >-
  Processes examples.
  Use when working with example files.
---

# Example Skill`

        const skill = parseSkill(markdown)

        expect(skill.description).toBe('Processes examples. Use when working with example files.')
    })

    it.each([
        ['no frontmatter', '# Example Skill'],
        ['missing opening delimiter', 'name: example-skill\ndescription: Processes examples.'],
        ['missing closing delimiter', '---\nname: example-skill\ndescription: Processes examples.'],
        ['invalid YAML', '---\nname: [example-skill\n---'],
        ['missing required name', '---\ndescription: Processes examples.\n---'],
        ['invalid name', '---\nname: Example_Skill\ndescription: Processes examples.\n---'],
        ['missing required description', '---\nname: example-skill\n---'],
        ['non-string description', '---\nname: example-skill\ndescription: 123\n---'],
        ['non-string metadata value', '---\nname: example-skill\ndescription: Processes examples.\nmetadata:\n  version: 1\n---']
    ])('rejects %s', (_case, markdown) => {
        expect(() => parseSkill(markdown)).toThrow()
    })
})
