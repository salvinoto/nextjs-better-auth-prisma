import { type AppType } from "@/app/api/[[...route]]/route";
import { hc } from "hono/client";

export const hono = hc<AppType>("http://localhost:3000/");
