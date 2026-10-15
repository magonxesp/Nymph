/**
 * Nymph
 * Copyright (C) 2026  MagonxESP
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { parseDocument } from 'yaml'
import { tool } from 'langchain'
import z from 'zod'
import fs from 'node:fs/promises'
import { skillsDir } from '../env.js'
import path from 'node:path'
import { log } from '../logging.js'

class SkillName {
    private constructor(public readonly value: string) {
        this.validate()
    }

    private validate(): void {
        const isString = typeof this.value === 'string'
        const hasValidLength = isString && this.value.length >= 1 && this.value.length <= 64
        const hasValidFormat = isString && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(this.value)

        if (!hasValidLength || !hasValidFormat) {
            throw new Error('The Skill name must be 1-64 lowercase letters, numbers, or hyphen-separated words')
        }
    }

    public static from(frontMatter: Record<string, unknown>): SkillName {
        if (frontMatter.name === undefined) {
            throw new Error('The Skill name is required')
        }

        return new SkillName(frontMatter.name as string)
    }
}

class SkillDescription {
    private constructor(public readonly value: string) {
        this.validate()
    }

    private validate(): void {
        const isString = typeof this.value === 'string'
        const hasValidLength = isString && this.value.length >= 1 && this.value.length <= 1024

        if (!hasValidLength) {
            throw new Error('The Skill description must be 1-1024 characters')
        }
    }

    public static from(frontMatter: Record<string, unknown>): SkillDescription {
        if (frontMatter.description === undefined) {
            throw new Error('The Skill description is required')
        }

        return new SkillDescription(frontMatter.description as string)
    }
}

class SkillLicense {
    private constructor(public readonly value: string) {
        this.validate()
    }

    private validate(): void {
        if (typeof this.value !== 'string') {
            throw new Error('The Skill license must be a string')
        }
    }

    public static from(frontMatter: Record<string, unknown>): SkillLicense | undefined {
        if (frontMatter.license === undefined) {
            return undefined
        }

        return new SkillLicense(frontMatter.license as string)
    }
}

class SkillCompatibility {
    private constructor(public readonly value: string) {
        this.validate()
    }

    private validate(): void {
        const isString = typeof this.value === 'string'
        const hasValidLength = isString && this.value.length >= 1 && this.value.length <= 500

        if (!hasValidLength) {
            throw new Error('The Skill compatibility must be 1-500 characters')
        }
    }

    public static from(frontMatter: Record<string, unknown>): SkillCompatibility | undefined {
        if (frontMatter.compatibility === undefined) {
            return undefined
        }

        return new SkillCompatibility(frontMatter.compatibility as string)
    }
}

class SkillMetadata {
    private constructor(public readonly value: Record<string, string>) {
        this.validate()
    }

    private validate(): void {
        const isObject = this.value !== null && typeof this.value === 'object'
        const isPlainObject = isObject
            && !Array.isArray(this.value)
            && [Object.prototype, null].includes(Object.getPrototypeOf(this.value))
        const hasStringValues = isPlainObject && Object.values(this.value).every(value => typeof value === 'string')

        if (!hasStringValues) {
            throw new Error('The Skill metadata must be a mapping of strings to strings')
        }
    }

    public static from(frontMatter: Record<string, unknown>): SkillMetadata | undefined {
        if (frontMatter.metadata === undefined) {
            return undefined
        }

        return new SkillMetadata(frontMatter.metadata as Record<string, string>)
    }
}

class SkillAllowedTools {
    private constructor(public readonly value: string) {
        this.validate()
    }

    private validate(): void {
        if (typeof this.value !== 'string') {
            throw new Error('The Skill allowed-tools must be a space-separated string')
        }
    }

    public static from(frontMatter: Record<string, unknown>): SkillAllowedTools | undefined {
        if (frontMatter['allowed-tools'] === undefined) {
            return undefined
        }

        return new SkillAllowedTools(frontMatter['allowed-tools'] as string)
    }
}

export class Skill {
    private readonly _name: SkillName
    private readonly _description: SkillDescription
    private readonly _license?: SkillLicense
    private readonly _compatibility?: SkillCompatibility
    private readonly _metadata?: SkillMetadata
    private readonly _allowedTools?: SkillAllowedTools

    constructor(frontMatter: unknown, public readonly content: string = '') {
        const isObject = frontMatter !== null && typeof frontMatter === 'object'
        const isPlainObject = isObject && !Array.isArray(frontMatter)

        if (!isPlainObject) {
            throw new Error('The Skill front matter must be an object')
        }

        const fields = frontMatter as Record<string, unknown>
        this._name = SkillName.from(fields)
        this._description = SkillDescription.from(fields)
        this._license = SkillLicense.from(fields)
        this._compatibility = SkillCompatibility.from(fields)
        this._metadata = SkillMetadata.from(fields)
        this._allowedTools = SkillAllowedTools.from(fields)
    }

    public get name(): string {
        return this._name.value
    }

    public get description(): string {
        return this._description.value
    }

    public get license(): string | undefined {
        return this._license?.value
    }

    public get compatibility(): string | undefined {
        return this._compatibility?.value
    }

    public get metadata(): Record<string, string> | undefined {
        return this._metadata?.value
    }

    public get allowedTools(): string | undefined {
        return this._allowedTools?.value
    }
}

export function parseSkill(skill: string): Skill {
    const lines = skill.split(/(?<=\n)/)
    const isFence = (line: string): boolean => line.replace(/\r?\n$/, '') === '---'
    const hasOpeningFence = isFence(lines[0])
    const closingFenceIndex = lines.findIndex((line, index) => index > 0 && isFence(line))
    const hasClosingFence = closingFenceIndex !== -1

    if (!hasOpeningFence || !hasClosingFence) {
        throw new Error('The Skill must begin with a closed YAML frontmatter block')
    }

    const rawFrontMatter = lines.slice(1, closingFenceIndex).join('')
    const content = lines.slice(closingFenceIndex + 1).join('')
    const document = parseDocument(rawFrontMatter)
    if (document.errors.length > 0) {
        throw new Error(`Invalid Skill YAML frontmatter: ${document.errors[0].message}`)
    }

    return new Skill(document.toJS(), content)
}

export const skills = new Map<string, Skill>()

export async function loadSkills() {
    let entries: string[]

    try {
        entries = await fs.readdir(skillsDir)
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return skills
        throw error
    }

    for (const name of entries) {
        const skillDir = path.join(skillsDir, name)
        const stat = await fs.stat(skillDir)

        if (!stat.isDirectory()) {
            log.warn({ skill: name, path: skillDir }, 'Skipping skill because it is not a directory')
            continue
        }

        const skillFile = path.join(skillDir, 'SKILL.md')

        try {
            await fs.access(skillFile)
        } catch (error) {
            log.warn({ skill: name, path: skillDir, error }, 'Skipping skill because it SKILL.md does not exists')
            continue
        }

        try {
            const skillContent = await fs.readFile(path.join(skillsDir, name, 'SKILL.md'), "utf8")
            const skill = parseSkill(skillContent)
            skills.set(name, skill)
        } catch (error) {
            log.warn({ skill: name, path: skillDir, error }, 'Skipping skill because it may be invalid or there were an IO error')
            continue
        }
    }
}

export const getSkillTool = tool(async ({ name }) => skills.get(name) ?? "Skill no disponible.", {
    name: "get_skill",
    description: "Carga las instrucciones completas de una skill disponible cuando la tarea lo requiera.",
    schema: z.object({ name: z.string().describe("Nombre de la skill sin .md") }),
})
