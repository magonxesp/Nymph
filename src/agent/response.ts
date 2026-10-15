export function getAnswer(content: unknown): string {
    if (typeof content === "string") {
        return content
    }

    if (!Array.isArray(content)) {
        return ""
    }

    const text: string[] = []

    for (const block of content) {
        if (typeof block === "object" && block !== null && "text" in block && typeof block.text === "string") {
            text.push(block.text)
        }
    }

    return text.join("")
}

export function getContentTypes(content: unknown): unknown {
    if (!Array.isArray(content)) {
        return typeof content
    }

    return content.map((block) => {
        if (typeof block === "object" && block !== null && "type" in block) {
            return block.type
        }

        return typeof block
    })
}
