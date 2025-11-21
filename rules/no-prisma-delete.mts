import type { TSESLint } from "@typescript-eslint/utils";

export default {
  meta: {
    type: "problem",
    docs: {
      description: "Don't use Prisma error-prone .delete function",
    },
    messages: {
      noPrismaDelete:
        "Prisma .delete(...) function is used. Use .deleteMany(..) and check count instead.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression: function (node) {
        // @ts-expect-error It ain't typing properly
        const funcId = node.callee.property;
        if (!funcId || funcId.name !== "delete") return;
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
