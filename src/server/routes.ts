import type { FastifyInstance } from "fastify";
import type { KVStore } from "../engine/kv-store.js";

interface KeyParams {
    key: string;
}

interface PutBody {
    value: string;
}

export function registerRoutes(app: FastifyInstance, store: KVStore): void {
    app.get("/health", async () => {
        return { status: "OK", service: "GrainDB" };
    });

    app.get("/v1/stats", async () => {
        return { keys: store.size() };
    });

    app.put<{ Params: KeyParams; Body: PutBody }>(
        "/v1/kv/:key",
        async (request, reply) => {
            const { key } = request.params;
            const { value } = request.body;

            if (typeof value !== "string") {
                return reply
                    .status(400)
                    .send({ error: "'value' must be a string" });
            }

            try {
                store.put(key, value);
            } catch (error) {
                return reply.status(400).send({
                    error:
                        error instanceof Error
                            ? error.message
                            : "Invalid request",
                });
            }

            return reply.status(200).send({ key, value });
        },
    );

    app.get<{ Params: KeyParams }>("/v1/kv/:key", async (request, reply) => {
        const { key } = request.params;

        try {
            const value = store.get(key);
            if (value === undefined) {
                return reply.status(404).send({ error: "Key not found" });
            }
            return reply.status(200).send({ key, value });
        } catch (error) {
            return reply.status(400).send({
                error:
                    error instanceof Error ? error.message : "Invalid request",
            });
        }
    });

    app.delete<{ Params: KeyParams }>("/v1/kv/:key", async (request, reply) => {
        const { key } = request.params;

        try {
            const deleted = store.delete(key);
            if (!deleted) {
                return reply.status(404).send({ error: "Key not found" });
            }
            return reply.status(204).send();
        } catch (error) {
            return reply.status(400).send({
                error:
                    error instanceof Error ? error.message : "Invalid request",
            });
        }
    });
}
