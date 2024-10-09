import { Hono } from "hono";
import { stripeRoute } from "./stripe";

const app = new Hono().basePath("/api");

const route = app
    .route("/stripe", stripeRoute);

export const GET = app.fetch;
export const POST = app.fetch;
export type AppType = typeof route;