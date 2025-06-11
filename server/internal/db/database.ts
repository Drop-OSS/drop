import { PrismaClient } from "~/prisma/client";
import { withPgTrgm } from "prisma-extension-pg-trgm";

const prismaClientSingleton = () => {
  return new PrismaClient({}).$extends(withPgTrgm({ logQueries: true }));
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;
