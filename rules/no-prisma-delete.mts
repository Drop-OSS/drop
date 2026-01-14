import type { TSESLint } from "@typescript-eslint/utils";

const blacklistedFunctions = ["delete", "update"];

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Don't use Prisma error-prone .delete or .update function",
    },
    messages: {
      noPrismaDelete:
        "Prisma .delete(...) or .update(...) function is used. Use .deleteMany(..) or .updateMany(...) and check count instead.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression: function (node) {
        // @ts-expect-error It ain't typing properly
        const funcId = node.callee.property;
        if (!funcId || !blacklistedFunctions.includes(funcId.name)) return;
        // @ts-expect-error It ain't typing properly
        const tableExpr = node.callee.object;
        if (!tableExpr) return;
        const prismaExpr = tableExpr.object;
        if (!prismaExpr || prismaExpr.name !== "prisma") return;
        context.report({
          node,
          messageId: "noPrismaDelete",
        });
      },
    };
  },
  defaultOptions: [],
} satisfies TSESLint.RuleModule<"noPrismaDelete">;
