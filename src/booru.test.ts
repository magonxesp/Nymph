import 'dotenv/config'
import { describe, expect, it } from 'vitest'
import { Rule34Client } from './booru.js'
import {rule34ApiKey, rule34UserId} from "./env.js";

const referencePostId = 19068437
const client = new Rule34Client()

describe('Rule34 API integration', () => {
    it('retrieves real tag suggestions', async () => {
        const tags = await client.autocompleteTags('ny')

        expect(tags.length).toBeGreaterThan(0)
        expect(tags).toEqual(expect.arrayContaining([
            expect.objectContaining({ value: 'nymph' })
        ]))
        expect(tags.every(tag => typeof tag.label === 'string' && typeof tag.value === 'string')).toBe(true)
    })

    describe.skipIf(!rule34ApiKey || !rule34UserId)('authenticated posts', () => {
        it('retrieves the reference post through the XML API', async () => {
            const posts = await client.getPosts('', { id: referencePostId, limit: 1 })

            expect(posts.count).toBeGreaterThan(0)
            expect(posts.offset).toBeGreaterThanOrEqual(0)
            expect(posts.items).toHaveLength(1)
            expect(posts.items[0].id).toBe(referencePostId)
            expect(typeof posts.items[0].file_url).toBe('string')
            expect(typeof posts.items[0].score).toBe('number')
            expect(typeof posts.items[0].has_children).toBe('boolean')
        })
    })
})
