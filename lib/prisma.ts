import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const createPrismaClient = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return new PrismaClient({ log: ["error", "warn"] });
  }

  // Check if running on Cloudflare Workers (Edge runtime)
  const isEdge = process.env.NEXT_RUNTIME === "edge";

  if (isEdge) {
    // Edge environment: Use @neondatabase/serverless to avoid eval()
    neonConfig.webSocketConstructor = ws; // Just in case, though usually not needed strictly on Edge unless using specific polyfills
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter, log: ["error", "warn"] });
  } else {
    // Node.js environment (Local development / Build)
    // Use standard 'pg' to allow direct TCP connections to localhost
    // We use require here to avoid bundling 'pg' into the Edge worker if possible, or just rely on runtime check
    // eslint-disable-next-line
    const pg = require("pg");
    const pool = new pg.Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter, log: ["error", "warn"] });
  }
};

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
