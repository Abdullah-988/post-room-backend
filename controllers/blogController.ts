import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import db from "../lib/db";

interface JWTPayload {
  id: number;
}

function isNumeric(value: string) {
  return /^\d+$/.test(value);
}

// @desc    Search for blogs
// @route   GET /api/search?query=&skip=0
// @access  Private
export const searchBlogs = async (req: Request, res: Response) => {
  try {
    let query = req.query.query as string;

    if (!query) {
      return res.status(400).send("Please provide a search query");
    }

    let skip;
    if (!req.query.skip || !isNumeric(req.query.skip as string)) {
      skip = 0;
    } else {
      skip = parseInt(req.query.skip as string);
    }

    const blogs = await db.blog.findMany({
      where: {
        title: {
          contains: query,
          mode: "insensitive",
        },
        draft: false,
      },
      skip,
      take: 10,
      select: {
        id: true,
        blogId: true,
        title: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        categories: {
          include: {
            category: true,
          },
        },
        author: {
          select: {
            id: true,
            fullname: true,
            username: true,
            imageUrl: true,
          },
        },
        _count: {
          select: {
            stars: true,
            comments: true,
          },
        },
        saves: {
          where: { userId: req.user.id },
          select: { id: true },
        },
      },
    });

    const blogsWithStarredAndSaved = await blogs.map(({ saves, ...blog }) => ({
      ...blog,
      saved: saves.length > 0,
    }));

    const recentSearches = await db.searches.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (recentSearches.length >= 5) {
      for (let i = 4; i < recentSearches.length; i++) {
        await db.searches.delete({
          where: {
            id: recentSearches[i].id,
          },
        });
      }
    }

    const isSearchDuplicated = await db.searches.findFirst({
      where: {
        content: query,
        userId: req.user.id,
      },
    });

    await db.searches.create({
      data: {
        content: query,
        userId: req.user.id,
      },
    });

    if (isSearchDuplicated) {
      await db.searches.delete({
        where: {
          id: isSearchDuplicated.id,
        },
      });
    }

    return res.status(200).json(blogsWithStarredAndSaved);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Create a comment on a blog
// @route   GET /api/blog/:id/comment
// @access  Private
export const getComments = async (req: Request, res: Response) => {
  try {
    const blogId = req.params.id as string;

    const blog = await db.blog.findUnique({
      where: {
        blogId,
        draft: false,
      },
    });

    if (!blog) {
      return res.status(404).send("Blog not found");
    }

    const comments = await db.comment.findMany({
      where: {
        blogId: blog.id,
      },
      select: {
        id: true,
        blogId: true,
        author: {
          select: {
            id: true,
            imageUrl: true,
            fullname: true,
            username: true,
          },
        },
        content: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(comments);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Create a comment on a blog
// @route   POST /api/blog/:id/comment
// @access  Private
export const createComment = async (req: Request, res: Response) => {
  try {
    const blogId = req.params.id as string;
    const { content } = req.body;

    const blog = await db.blog.findUnique({
      where: {
        blogId,
        draft: false,
      },
    });

    if (!blog) {
      return res.status(404).send("Blog not found");
    }

    if (!content) {
      return res.status(400).send("Missing comment content");
    }

    const comment = await db.comment.create({
      data: {
        content,
        blogId: blog.id,
        authorId: req.user.id,
      },
    });

    return res.status(201).json(comment);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Edit a comment on a blog
// @route   PUT /api/blog/comment/:id
// @access  Private
export const editComment = async (req: Request, res: Response) => {
  try {
    const commentId = parseInt(req.params.id as string);
    const { content } = req.body;

    const comment = await db.comment.findUnique({
      where: {
        id: commentId,
      },
    });

    if (!comment) {
      return res.status(404).send("Comment not found");
    }

    if (comment.authorId != req.user.id) {
      return res.status(403).send("Cannot edit a comment you do not own");
    }

    if (!content) {
      return res.status(400).send("Missing comment content");
    }

    const editedComment = await db.comment.update({
      where: {
        id: commentId,
      },
      data: {
        content,
      },
    });

    return res.status(200).json(editedComment);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Delete a comment from a blog
// @route   DELETE /api/blog/comment/:id
// @access  Private
export const deleteComment = async (req: Request, res: Response) => {
  try {
    const commentId = parseInt(req.params.id as string);

    const comment = await db.comment.findUnique({
      where: {
        id: commentId,
      },
    });

    if (!comment) {
      return res.status(404).send("Comment not found");
    }

    const blog = await db.blog.findUnique({
      where: {
        id: comment.blogId,
      },
    });

    if (req.user.id != comment.authorId && req.user.id != blog?.authorId) {
      return res.status(403).send("Forbidden");
    }

    const deletedComment = await db.comment.delete({
      where: {
        id: commentId,
      },
    });

    return res.status(200).json(deletedComment);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Star a blog
// @route   POST /api/blog/star/:id
// @access  Private
export const starBlog = async (req: Request, res: Response) => {
  try {
    const blogId = req.params.id as string;

    const blog = await db.blog.findUnique({
      where: {
        blogId,
      },
    });

    if (!blog) {
      return res.status(404).send("Blog not found");
    }

    const isBlogAlreadyStarred = await db.starOnBlogs.findFirst({
      where: {
        blogId: blog.id,
        userId: req.user.id,
      },
    });

    if (isBlogAlreadyStarred) {
      return res.status(400).send("You already starred this blog");
    }

    const starredBlog = await db.starOnBlogs.create({
      data: {
        blogId: blog.id,
        userId: req.user.id,
      },
    });

    return res.status(200).json(starredBlog);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Unstar a blog
// @route   DELETE /api/blog/star/:id
// @access  Private
export const unstarBlog = async (req: Request, res: Response) => {
  try {
    const blogId = req.params.id as string;

    const blog = await db.blog.findUnique({
      where: {
        blogId,
      },
    });

    if (!blog) {
      return res.status(404).send("Blog not found");
    }

    const isBlogStarred = await db.starOnBlogs.findFirst({
      where: {
        blogId: blog.id,
        userId: req.user.id,
      },
    });

    if (!isBlogStarred) {
      return res.status(400).send("You didn't star this blog");
    }

    const staredBlog = await db.starOnBlogs.delete({
      where: {
        id: isBlogStarred.id,
      },
    });

    return res.status(200).json(staredBlog);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Get saved blogs
// @route   GET /api/list
// @access  Private
export const getSavedBlogs = async (req: Request, res: Response) => {
  try {
    const blogs = await db.list.findMany({
      where: {
        userId: req.user.id,
      },
      select: {
        blog: {
          select: {
            id: true,
            blogId: true,
            title: true,
            content: true,
            imageUrl: true,
            createdAt: true,
            updatedAt: true,
            categories: {
              include: {
                category: true,
              },
            },
            author: {
              select: {
                id: true,
                imageUrl: true,
                fullname: true,
                username: true,
              },
            },
            _count: {
              select: {
                stars: true,
              },
            },
          },
        },
      },
    });

    return res.status(200).json(blogs);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Add a blog to list
// @route   POST /api/list/blog/:id
// @access  Private
export const addBlog = async (req: Request, res: Response) => {
  try {
    const blogId = req.params.id as string;

    const blog = await db.blog.findUnique({
      where: {
        blogId,
      },
    });

    if (!blog) {
      return res.status(404).send("Blog not found");
    }

    const isBlogInList = await db.list.findFirst({
      where: {
        blogId: blog.id,
        userId: req.user.id,
      },
    });

    if (isBlogInList) {
      return res.status(400).send("Blog is already in list");
    }

    const addedBlog = await db.list.create({
      data: {
        blogId: blog.id,
        userId: req.user.id,
      },
    });

    return res.status(200).json(addedBlog);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Remove a blog from list
// @route   DELETE /api/list/blog/:id
// @access  Private
export const removeBlog = async (req: Request, res: Response) => {
  try {
    const blogId = req.params.id as string;

    const blog = await db.blog.findUnique({
      where: {
        blogId,
      },
    });

    if (!blog) {
      return res.status(404).send("Blog not found");
    }

    const isBlogInList = await db.list.findFirst({
      where: {
        blogId: blog.id,
        userId: req.user.id,
      },
    });

    if (!isBlogInList) {
      return res.status(400).send("Blog is not in list");
    }

    const removedBlog = await db.list.delete({
      where: {
        id: isBlogInList.id,
      },
    });

    return res.status(200).json(removedBlog);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Get blogs
// @route   GET /api/blog?skip=0
// @access  Private
export const getBlogs = async (req: Request, res: Response) => {
  try {
    let skip: number;
    if (!req.query.skip || !isNumeric(req.query.skip as string)) {
      skip = 0;
    } else {
      skip = parseInt(req.query.skip as string);
    }

    const blogs = await db.blog.findMany({
      where: {
        draft: false,
      },
      skip,
      take: 10,
      select: {
        id: true,
        blogId: true,
        title: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        categories: {
          include: {
            category: true,
          },
        },
        author: {
          select: {
            id: true,
            imageUrl: true,
            fullname: true,
            username: true,
          },
        },
        _count: {
          select: {
            stars: true,
            comments: true,
          },
        },
        saves: {
          where: { userId: req.user.id },
          select: { id: true },
        },
      },
    });

    const blogsWithStarredAndSaved = await blogs.map(({ saves, ...blog }) => ({
      ...blog,
      saved: saves.length > 0,
    }));

    return res.status(200).json(blogsWithStarredAndSaved);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Get user drafted blogs
// @route   GET /api/blog/draft
// @access  Private
export const getDraftedBlogs = async (req: Request, res: Response) => {
  try {
    const blogs = await db.blog.findMany({
      where: {
        draft: true,
        authorId: req.user.id,
      },
      select: {
        id: true,
        blogId: true,
        title: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        categories: {
          include: {
            category: true,
          },
        },
        author: {
          select: {
            id: true,
            imageUrl: true,
            fullname: true,
            username: true,
          },
        },
        _count: {
          select: {
            stars: true,
            comments: true,
          },
        },
        saves: {
          where: { userId: req.user.id },
          select: { id: true },
        },
      },
    });

    return res.status(200).json(blogs);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Get a blog
// @route   GET /api/blog/:id
// @access  Public
export const getBlog = async (req: Request, res: Response) => {
  try {
    const blogId = req.params.id;

    const token = req?.headers?.authorization?.split(" ")[1];

    let user = { id: 0 } as any;
    if (token) {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET!
        ) as unknown as JWTPayload;

        user = await db.user.findUnique({
          where: {
            id: decoded.id,
          },
          select: {
            id: true,
            fullname: true,
            username: true,
            bio: true,
            email: true,
            isEmailVerified: true,
            createdAt: true,
            updatedAt: true,
          },
        });
      } catch {
        return res.status(401).send("Invalid token");
      }
    }

    const blog = await db.blog.findUnique({
      where: {
        blogId,
      },
      select: {
        id: true,
        blogId: true,
        title: true,
        content: true,
        imageUrl: true,
        draft: true,
        createdAt: true,
        updatedAt: true,
        categories: {
          include: {
            category: true,
          },
        },
        author: {
          select: {
            id: true,
            imageUrl: true,
            fullname: true,
            username: true,
          },
        },
        _count: {
          select: {
            stars: true,
            comments: true,
          },
        },
        stars: {
          where: { userId: user.id },
          select: { id: true },
        },
        saves: {
          where: { userId: user.id },
          select: { id: true },
        },
      },
    });

    if (!blog) {
      return res.status(404).send("Blog not found");
    }

    if (blog.draft && blog.author.id != user.id) {
      return res.status(404).send("Blog not found");
    }

    const { stars, saves, ...rest } = blog;

    const isStarredByUser = blog.stars.length > 0;
    const isSavedByUser = blog.saves.length > 0;

    let isFollowingAuthor = false;
    if (user.id != 0) {
      isFollowingAuthor = !!(await db.follow.findFirst({
        where: {
          userId: blog.author.id,
          followerId: user.id,
        },
      }));
    }

    return res.status(200).json({
      ...rest,
      starred: isStarredByUser,
      saved: isSavedByUser,
      following: isFollowingAuthor,
    });
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Get blogs by a category
// @route   GET /api/blog/category/:category?skip=0
// @access  Private
export const getCategoryBlogs = async (req: Request, res: Response) => {
  try {
    const categoryName = req.params.category;

    const category = await db.category.findUnique({
      where: {
        name: categoryName,
      },
    });

    if (!category) {
      return res.status(200).send([]);
    }

    let skip: number;
    if (!req.query.skip || !isNumeric(req.query.skip as string)) {
      skip = 0;
    } else {
      skip = parseInt(req.query.skip as string);
    }

    const blogs = await db.blog.findMany({
      where: {
        categories: {
          some: {
            categoryId: category.id,
          },
        },
      },
      skip,
      take: 10,
      select: {
        id: true,
        blogId: true,
        title: true,
        content: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        categories: {
          include: {
            category: true,
          },
        },
        author: {
          select: {
            id: true,
            imageUrl: true,
            fullname: true,
            username: true,
          },
        },
        _count: {
          select: {
            stars: true,
            comments: true,
          },
        },
        saves: {
          where: { userId: req.user.id },
          select: { id: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const blogsWithStarredAndSaved = await blogs.map(({ saves, ...blog }) => ({
      ...blog,
      saved: saves.length > 0,
    }));

    return res.status(200).json(blogsWithStarredAndSaved);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Get all categories
// @route   GET /api/category
// @access  Private
export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await db.category.findMany();

    return res.status(200).json(categories);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Create a blog
// @route   POST /api/blog
// @access  Private
export const createBlog = async (req: Request, res: Response) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).send("Missing required fields");
    }

    // Generate a 16 characters long id
    const blogId = [...Array(30)]
      .map(() => Math.random().toString(36)[2])
      .slice(0, 16)
      .join("");

    const blog = await db.blog.create({
      data: {
        blogId,
        title,
        content,
        authorId: req.user.id,
      },
    });

    return res.status(201).json(blog);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Publish a draft blog
// @route   PATCH /api/blog/:id
// @access  Private
export const publishBlog = async (req: Request, res: Response) => {
  try {
    const blogId = req.params.id as string;

    const blog = await db.blog.findUnique({
      where: {
        blogId,
        draft: true,
      },
    });

    if (!blog) {
      return res.status(404).send("Blog not found");
    }

    if (blog.authorId != req.user.id) {
      return res.status(403).send("Forbidden");
    }

    if (!blog.title || !blog.content) {
      return res.status(400).send("Blog title and content cannot be empty");
    }

    const publishedBlog = await db.blog.update({
      where: {
        blogId,
      },
      data: {
        draft: false,
      },
    });

    const followers = await db.follow.findMany({
      where: {
        userId: blog.authorId,
      },
    });

    if (followers.length > 0) {
      for (let i = 0; i < followers.length; i++) {
        await db.notification.create({
          data: {
            blogId: blog.id,
            userId: followers[i].followerId,
          },
        });
      }
    }

    const { draft, ...rest } = publishedBlog;

    return res.status(200).json(rest);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Edit a blog
// @route   PUT /api/blog/:id
// @access  Private
export const editBlog = async (req: Request, res: Response) => {
  try {
    const { title, content, imageUrl, categories } = req.body;
    const blogId = req.params.id as string;

    const blog = await db.blog.findUnique({
      where: {
        blogId,
      },
    });

    if (!blog) {
      return res.status(404).send("Blog not found");
    }

    let defaultImageUrl;

    if (!imageUrl) {
      defaultImageUrl = blog.imageUrl;
    }

    if (blog.authorId != req.user.id) {
      return res.status(403).send("Forbidden");
    }

    const editedBlog = await db.blog.update({
      where: {
        id: blog.id,
      },
      data: {
        title,
        content,
        imageUrl: defaultImageUrl,
      },
    });

    await db.categoryOnBlogs.deleteMany({
      where: {
        blogId: blog.id,
      },
    });

    if (categories.length != 0) {
      for (let i = 0; i < categories.length; i++) {
        let category = await db.category.findUnique({
          where: {
            name: categories[i],
          },
        });

        if (!category) {
          category = await db.category.create({
            data: {
              name: categories[i],
            },
          });
        }

        await db.categoryOnBlogs.create({
          data: {
            blogId: blog.id,
            categoryId: category.id,
          },
        });
      }
    }

    return res.status(200).json(editedBlog);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Delete a blog
// @route   DELETE /api/blog/:id
// @access  Private
export const deleteBlog = async (req: Request, res: Response) => {
  try {
    const blogId = parseInt(req.params.id);

    const blog = await db.blog.findUnique({
      where: {
        id: blogId,
      },
    });

    if (!blog) {
      return res.status(404).send("Blog not found");
    }

    if (blog.authorId != req.user.id) {
      return res.status(403).send("Forbidden");
    }

    const deletedBlog = await db.blog.delete({
      where: {
        id: blogId,
      },
    });

    return res.status(200).json(deletedBlog);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};
