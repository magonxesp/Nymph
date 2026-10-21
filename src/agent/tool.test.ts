import { afterEach, describe, expect, it, vi } from "vitest"
import { Rule34Client } from "../booru.js"
import { rule34AutocompleteTags, rule34RandomPost } from "./tool.js"
import { downloadImages } from "../media/remote.js"
import { AIMessage, ToolMessage } from "@langchain/core/messages"
import { ChatOpenAI } from "@langchain/openai"

vi.mock("../media/remote.js", () => ({ downloadImages: vi.fn() }))

afterEach(() => {
    vi.restoreAllMocks()
})

describe("Rule34 tools", () => {
    it("returns autocomplete error details to the model without throwing", async () => {
        vi.spyOn(Rule34Client.prototype, "autocompleteTags")
            .mockRejectedValue(new Error("Booru request failed with HTTP 503"))

        await expect(rule34AutocompleteTags.invoke({ tag: "example" })).resolves.toEqual({
            error: "Booru request failed with HTTP 503"
        })
    })

    it("returns random post error details to the model without throwing", async () => {
        vi.spyOn(Rule34Client.prototype, "getRandomPost")
            .mockRejectedValue(new Error("Invalid booru posts response"))

        await expect(rule34RandomPost.invoke({ tag: "example" })).resolves.toEqual({
            error: "Invalid booru posts response"
        })
    })

    it("handles failures that are not Error instances", async () => {
        vi.spyOn(Rule34Client.prototype, "autocompleteTags").mockRejectedValue("Connection lost")

        await expect(rule34AutocompleteTags.invoke({ tag: "example" })).resolves.toEqual({
            error: "Connection lost"
        })
    })

    it("keeps empty searches distinct from failures", async () => {
        vi.spyOn(Rule34Client.prototype, "getRandomPost").mockResolvedValue(undefined)

        await expect(rule34RandomPost.invoke({ tag: "example" })).resolves.toBe(
            "No se encontraron posts para el tag example."
        )
    })

    it("returns tag suggestions on success", async () => {
        const tags = [{ label: "example", value: "example" }]
        vi.spyOn(Rule34Client.prototype, "autocompleteTags").mockResolvedValue(tags)

        await expect(rule34AutocompleteTags.invoke({ tag: "example" })).resolves.toEqual(tags)
    })

    it("returns the original URL and downloaded images as visual tool content", async () => {
        vi.spyOn(Rule34Client.prototype, "getRandomPost").mockResolvedValue({
            id: 1,
            file_url: "https://example.com/image.jpg",
            tags: "example",
            rating: "s",
            score: 1
        })

        vi.mocked(downloadImages).mockResolvedValue(["data:image/jpeg;base64,AQID"])

        const result = await rule34RandomPost.invoke({
            type: "tool_call",
            id: "call-image",
            name: "rule34_random_post",
            args: { tag: "example" }
        })

        expect(downloadImages).toHaveBeenCalledWith("https://example.com/image.jpg")
        expect(result).toBeInstanceOf(ToolMessage)
        expect(result.content).toEqual([
            { type: "text", text: "https://example.com/image.jpg" },
            { type: "image_url", image_url: { url: "data:image/jpeg;base64,AQID" } }
        ])
        expect(result.contentBlocks).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: "image" })
        ]))

        const requests = vi.fn()
        const model = new ChatOpenAI({
            apiKey: "test-key",
            model: "test-model",
            useResponsesApi: true,
            configuration: {
                fetch: async (input, init) => {
                    const request = new Request(input, init)
                    requests(await request.json())

                    return Response.json({
                        id: "resp_test",
                        object: "response",
                        created_at: 0,
                        status: "completed",
                        model: "test-model",
                        output: [{
                            id: "msg_test",
                            type: "message",
                            role: "assistant",
                            status: "completed",
                            content: [{ type: "output_text", text: "OK", annotations: [] }]
                        }]
                    })
                }
            }
        })

        await model.invoke([
            new AIMessage({
                content: "",
                tool_calls: [{ id: "call-image", name: "rule34_random_post", args: { tag: "example" } }]
            }),
            result
        ])

        expect(requests).toHaveBeenCalledWith(expect.objectContaining({
            input: expect.arrayContaining([
                expect.objectContaining({
                    type: "function_call_output",
                    call_id: "call-image",
                    output: [
                        { type: "input_text", text: "https://example.com/image.jpg" },
                        expect.objectContaining({ type: "input_image", image_url: "data:image/jpeg;base64,AQID" })
                    ]
                })
            ])
        }))
    })

    it("keeps the original URL available when the visual download fails", async () => {
        vi.spyOn(Rule34Client.prototype, "getRandomPost").mockResolvedValue({
            id: 1,
            file_url: "https://example.com/image.jpg",
            tags: "example",
            rating: "s",
            score: 1
        })
        vi.mocked(downloadImages).mockRejectedValue(new Error("Media download failed with HTTP 503"))

        await expect(rule34RandomPost.invoke({ tag: "example" })).resolves.toEqual([
            { type: "text", text: "https://example.com/image.jpg" }
        ])
    })
})
