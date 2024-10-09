import { type AppType } from "@/app/api/[[...route]]/route";
import { hc } from "hono/client";

export const hono = hc<AppType>(process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_VERCEL_URL ?? "http://localhost:3000", {});
