import prisma from "../db/database";
import objectHandler from "../objects";

class NewsManager {
  async create(data: {
    title: string;
    content: string;
    description: string;
    tags: string[];
    authorId: string;
    imageObjectId?: string;
  }) {
    return await prisma.article.create({
      data: {
        title: data.title,
        description: data.description,
        content: data.content,

        tags: {
          connectOrCreate: data.tags.map((e) => ({
            where: { name: e },
            create: { name: e },
          })),
        },

        ...(data.imageObjectId && { imageObjectId: data.imageObjectId }),
        author: {
          connect: {
            id: data.authorId,
          },
        },
      },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
          },
        },
        tags: true,
      },
    });
  }

  async fetch(
    options: {
      take?: number;
      skip?: number;
      orderBy?: "asc" | "desc";
      tags?: string[];
      search?: string;
    } = {},
  ) {
    return await prisma.article.findMany({
      where: {
        AND: [
          options.tags
            ? {
                tags: {
                  some: { OR: options.tags?.map((e) => ({ name: e })) ?? [] },
                },
              }
            : undefined,
          options.search
            ? {
                title: {
                  search: options.search,
                },
                description: {
                  search: options.search,
                },
                content: {
                  search: options.search,
                },
              }
            : undefined,
        ].filter((e) => e !== undefined),
      },
      take: options?.take || 10,
      skip: options?.skip || 0,
      orderBy: {
        publishedAt: options?.orderBy || "desc",
      },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
          },
        },
        tags: true,
      },
    });
  }

  async fetchById(id: string) {
    return await prisma.article.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
          },
        },
        tags: true,
      },
    });
  }

  async update(
    id: string,
    data: {
      title?: string;
      content?: string;
      excerpt?: string;
      image?: string;
    },
  ) {
    return await prisma.article.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    const article = await prisma.article.delete({
      where: { id },
    });
    if (article.imageObjectId) {
      return await objectHandler.deleteAsSystem(article.imageObjectId);
    }
    return true;
  }
}

export default new NewsManager();
