import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { error } from "console";

const app = new Hono().basePath("/api");

const route = app.get(
    "/hello",
    zValidator(
        "query",
        z.object({
            name: z.string(),
        }),
    ),
    (c) => {
        const { name } = c.req.valid("query");
        return c.json({
            message: `Hello ${name}`,
        });
    },
)
    .post(
        "/authorized",
        zValidator(
            "json",
            z.object({
                name: z.string(),
            }),
        ),
        async (c) => {
            const { name } = c.req.valid("json");
            const session = await auth.api.getSession({
                headers: headers(),
            }).catch((e) => {
                throw error(401, "Unauthorized");
            });

            // console.log("session", session);
            if (session) {
                return c.json({
                    message: `Hi ${name}. You are authorized to access this route. Your session is ${JSON.stringify(session)}.`,
                });
            } else {
                return c.json({
                    message: `Hi ${name}. You are not authorized to access this route. Your session is ${JSON.stringify(session)}.`,
                });
            }
        },
    );

export const GET = app.fetch;
export const POST = app.fetch;
export type AppType = typeof route;