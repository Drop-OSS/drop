import prisma from "../db/database";

class NewsManager {
  async create(data: {
    title: string;
    content: string;
    excerpt: string;
    tags: string[];
    authorId: string;
    image?: string;
  }) {
    return await prisma.news.create({
      data: {
        title: data.title,
        content: data.content,
        excerpt: data.excerpt,
        tags: data.tags,
        image: data.image,
        author: {
          connect: {
            id: data.authorId,
          },
        },
        publishedAt: new Date(),
      },
    });
  }

  async getAll(options?: {
    take?: number;
    skip?: number;
    orderBy?: 'asc' | 'desc';
    tags?: string[];
    search?: string;
  }) {
    const where = {
      AND: [
        options?.tags?.length ? {
          tags: {
            hasSome: options.tags,
          },
        } : {},
        options?.search ? {
          OR: [
            {
              title: {
                contains: options.search,
                mode: 'insensitive' as const,
              },
            },
            {
              content: {
                contains: options.search,
                mode: 'insensitive' as const,
              },
            },
          ],
        } : {},
      ],
    };

    return await prisma.news.findMany({
      where,
      take: options?.take,
      skip: options?.skip,
      orderBy: {
        publishedAt: options?.orderBy || 'desc',
      },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });
  }

  async getById(id: string) {
    return await prisma.news.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });
  }

  async update(id: string, data: {
    title?: string;
    content?: string;
    excerpt?: string;
    tags?: string[];
    image?: string;
  }) {
    return await prisma.news.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return await prisma.news.delete({
      where: { id },
    });
  }
}

export default new NewsManager(); 
