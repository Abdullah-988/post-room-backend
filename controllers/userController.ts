import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import db from "../lib/db";
import crypto from "crypto";
import { sendMail } from "../lib/nodemailer";
import axios from "axios";

// @desc    Get a user profile
// @route   GET /api/user/:username
// @access  Private
export const getProfile = async (req: Request, res: Response) => {
  try {
    const username = req.params.username as string;

    const user = await db.user.findUnique({
      where: {
        username,
      },
      select: {
        id: true,
        fullname: true,
        bio: true,
        username: true,
        imageUrl: true,
        _count: {
          select: {
            followers: true,
            followed: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).send("Account not found");
    }

    const userBlogs = await db.blog.findMany({
      where: {
        authorId: user.id,
        draft: false,
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
        _count: {
          select: {
            stars: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    let response = { ...user, blogs: userBlogs } as any;

    if (user.id != req.user.id) {
      const isFollowing = await db.follow.findFirst({
        where: {
          userId: user.id,
          followerId: req.user.id,
        },
      });

      response = { ...response, following: !!isFollowing };
    }

    return res.status(200).json(response);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Get user's recent searches
// @route   GET /api/search/recent
// @access  Private
export const recentSearches = async (req: Request, res: Response) => {
  try {
    const searches = await db.searches.findMany({
      where: {
        userId: req.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(searches);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Remove a user's recent search
// @route   DELETE /api/search/:id
// @access  Private
export const deleteSearch = async (req: Request, res: Response) => {
  try {
    const searchId = parseInt(req.params.id as string);

    const search = await db.searches.findUnique({
      where: {
        id: searchId,
      },
    });

    if (!search) {
      return res.status(404).send("Recent search not found");
    }

    if (search.userId != req.user.id) {
      return res.status(403).send("Forbidden");
    }

    await db.searches.delete({
      where: {
        id: search.id,
      },
    });

    return res.status(200).json(search);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Follow an account
// @route   POST /api/follow/:username
// @access  Private
export const followUser = async (req: Request, res: Response) => {
  try {
    const username = req.params.username as string;

    const user = await db.user.findUnique({
      where: {
        username,
      },
    });

    if (!user) {
      return res.status(404).send("Account not found");
    }

    if (user.id == req.user.id) {
      return res.status(403).send("You cannot follow yourself");
    }

    const isUserFollowing = await db.follow.findFirst({
      where: {
        userId: user.id,
        followerId: req.user.id,
      },
    });

    if (isUserFollowing) {
      return res.status(400).send("You already follow this account");
    }

    const follow = await db.follow.create({
      data: {
        userId: user.id,
        followerId: req.user.id,
      },
    });

    return res.status(200).json(follow);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Unfollow an account
// @route   DELETE /api/follow/:username
// @access  Private
export const unFollowUser = async (req: Request, res: Response) => {
  try {
    const username = req.params.username as string;

    const user = await db.user.findUnique({
      where: {
        username,
      },
    });

    if (!user) {
      return res.status(404).send("Account not found");
    }

    const isUserFollowing = await db.follow.findFirst({
      where: {
        userId: user.id,
        followerId: req.user.id,
      },
    });

    if (!isUserFollowing) {
      return res.status(400).send("You do not follow this account");
    }

    const follow = await db.follow.delete({
      where: {
        id: isUserFollowing.id,
      },
    });

    return res.status(200).json(follow);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Get all user notifications
// @route   GET /api/notification
// @access  Private
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const notifications = await db.notification.findMany({
      where: {
        userId: req.user.id,
      },
      select: {
        id: true,
        blog: {
          select: {
            id: true,
            blogId: true,
            imageUrl: true,
            title: true,
            author: {
              select: {
                id: true,
                fullname: true,
                username: true,
                imageUrl: true,
              },
            },
          },
        },
        createdAt: true,
        seen: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json(notifications);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Mark all user notifications as seen
// @route   PATCH /api/notification
// @access  Private
export const markNotificationsAsSeen = async (req: Request, res: Response) => {
  try {
    const notifications = await db.notification.updateMany({
      where: {
        userId: req.user.id,
      },
      data: {
        seen: true,
      },
    });

    return res.status(200).json(notifications);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Edit user data
// @route   PUT /api/user
// @access  Private
export const editUser = async (req: Request, res: Response) => {
  try {
    const { fullname, username, bio, imageUrl } = req.body;

    if (!fullname && !username && !bio && !imageUrl) {
      return res.status(400).send("Missing fields");
    }

    let defaultFullname: string | null | undefined;
    if (!!fullname) {
      if (fullname.length > 50 || fullname.length < 3) {
        return res.status(400).send("Fullname length is not supported");
      }

      defaultFullname = fullname;
    } else {
      defaultFullname = req.user.fullname;
    }

    let defaultUsername: string | null | undefined;
    if (!!username) {
      const regex = /^(?!\d)[a-z0-9.]+$/;

      if (!regex.test(username) || username.length > 50 || username.length < 3) {
        return res.status(422).send("Username format is not supported");
      }

      const usernameTaken = await db.user.findUnique({
        where: {
          username,
        },
      });

      if (!!usernameTaken) {
        return res.status(400).send("Username is taken");
      }

      defaultUsername = username;
    } else {
      defaultUsername = req.user.username;
    }

    let defaultBio: string | null | undefined;
    if (!!bio) {
      if (bio.length > 250) {
        return res.status(422).send("Bio is too long");
      }

      defaultBio = bio;
    } else {
      defaultBio = req.user.bio;
    }

    let defaultImageUrl: string | null | undefined = imageUrl;
    if (!imageUrl) {
      defaultImageUrl = req.user.imageUrl;
    } else if (imageUrl == "none") {
      defaultImageUrl = null;
    }

    const user = await db.user.update({
      where: {
        id: req.user.id,
      },
      data: {
        fullname: defaultFullname,
        username: defaultUsername,
        bio: defaultBio,
        imageUrl: defaultImageUrl,
      },
      select: {
        id: true,
        fullname: true,
        username: true,
        email: true,
        bio: true,
        imageUrl: true,
      },
    });

    return res.status(200).json(user);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Request a password reset email
// @route   POST /api/user/reset-password
// @access  Public
export const resetPasswordRequest = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).send("Missing email address");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(422).send("Invalid email format");
    }

    const doesUserExist = await db.user.findUnique({
      where: {
        email,
      },
    });

    if (!doesUserExist) {
      return res.status(404).send("Email cannot be found or signed in using a provider");
    }

    if (doesUserExist.provider != "DEFAULT") {
      return res.status(404).send("Email cannot be found or signed in using a provider");
    }

    const passwordResetTokenString =
      crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

    const passwordReset = await db.passwordResetToken.create({
      data: {
        token: passwordResetTokenString,
        userId: doesUserExist.id,
      },
    });

    if (!passwordReset) {
      return res.status(500).send("There is an error while handling your request");
    }

    const url = req.headers.origin;

    const passwordResetUrl = `${url}/reset-password/${passwordReset.token}`;

    await sendMail({
      subject: "Password reset request for Post Room account",
      email: doesUserExist.email,
      html: `
      <div>
        <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 1rem;">Reset your Post Room email password</h1>
        <a href=${passwordResetUrl} target="_blank" style="background-color: #0072dd; font-size: 14px; color: #ffffff; font-weight: 600; border-radius: 0.5rem; padding: 0.75rem; text-decoration: none;">
          Reset Your Password
        </a>
        <div style="margin-top: 5rem;">
          <h2 style="font-size: 14px; margin-bottom: 1rem;">If you can't see the button, Use this link instead:</h2>
          <a href=${passwordResetUrl} target="_blank" style="color: #0072dd;">${passwordResetUrl}</a>
        </div>
        <p style="margin-top: 1rem;">This link will expire in 24 hours</p>
      </div>
      `,
    });

    return res.status(200).send("Password reset link sent to email");
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Change an account password
// @route   POST /api/user/reset-password/:token
// @access  Public
export const resetAccountPassword = async (req: Request, res: Response) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).send("Missing new password");
    }

    const token = await db.passwordResetToken.findUnique({
      where: {
        token: req.params.token,
      },
    });

    if (!token) {
      return res.status(400).send("Token expired or not valid");
    }

    if (
      (new Date().getTime() - new Date(token.createdAt).getTime()) / (1000 * 3600) >
      24
    ) {
      return res.status(400).send("Token expired or not valid");
    }

    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

    if (!passwordRegex.test(password)) {
      return res.status(422).send("Password does not meet security requirments");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await db.user.update({
      where: {
        id: token.userId,
      },
      data: {
        hashedPassword,
      },
      select: {
        id: true,
        fullname: true,
        username: true,
        bio: true,
        imageUrl: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await db.passwordResetToken.update({
      where: {
        id: token.id,
      },
      data: {
        resetAt: new Date(),
      },
    });

    return res.status(200).json(user);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Activate an account
// @route   POST /api/activate/:token
// @access  Public
export const activateAccount = async (req: Request, res: Response) => {
  try {
    const token = await db.activateToken.findUnique({
      where: {
        token: req.params.token,
      },
    });

    if (!token) {
      return res.status(400).send("Token not valid");
    }

    const isUserVerified = await db.user.findFirst({
      where: {
        id: token.userId,
        isEmailVerified: true,
      },
    });

    if (isUserVerified) {
      return res.status(400).send("Email is already verified");
    }

    const user = await db.user.update({
      where: {
        id: token.userId,
      },
      data: {
        isEmailVerified: true,
      },
      select: {
        id: true,
        fullname: true,
        username: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json(user);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Register or Login new user with provider
// @route   POST /api/oauth
// @access  Public
export const authorizeUserWithProvider = async (req: Request, res: Response) => {
  try {
    const { token, provider } = req.body as {
      token: string;
      provider: "google";
    };

    if (!token || !provider) {
      return res.status(400).send("Missing required fields");
    }

    if (provider.toLowerCase() == "google") {
      const userRes = await axios.get(
        `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${token}`
      );

      if (!userRes) {
        return res.status(404).send("Invalid token");
      }

      const userExists = await db.user.findFirst({
        where: {
          email: userRes.data.email,
        },
        select: {
          id: true,
          fullname: true,
          username: true,
          email: true,
          provider: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (userExists) {
        const JWTToken = await generateToken(userExists.id);

        res.setHeader("Authorization", `Bearer ${JWTToken}`);

        return res.status(200).json(userExists);
      }

      const newUser = await db.user.create({
        data: {
          email: userRes.data.email,
          provider: "GOOGLE",
          isEmailVerified: true,
        },
        select: {
          id: true,
          email: true,
          fullname: true,
          username: true,
          provider: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!newUser) {
        return res.status(400).send("Invalid user data");
      }

      const JWTToken = await generateToken(newUser.id);

      res.setHeader("Authorization", `Bearer ${JWTToken}`);

      return res.status(201).json(newUser);
    } else {
      return res.status(400).send("Invalid provider name");
    }
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Register new user
// @route   POST /api/register
// @access  Public
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send("Missing required fields");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(422).send("Invalid email format");
    }

    const userExists = await db.user.findFirst({
      where: {
        email,
      },
    });

    if (userExists) {
      return res.status(400).send("User already exists");
    }

    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

    if (!passwordRegex.test(password)) {
      return res.status(422).send("Password does not meet security requirments");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await db.user.create({
      data: {
        email,
        hashedPassword,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!newUser) {
      return res.status(400).send("Invalid user data");
    }

    const authTokenString =
      crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

    const authToken = await db.activateToken.create({
      data: {
        token: authTokenString,
        userId: newUser.id,
      },
    });

    const url = req.headers.origin;

    const activateUrl = `${url}/activate/${authToken.token}`;

    await sendMail({
      subject: "Verify your Post Room account email",
      email: newUser.email,
      html: `
      <div>
        <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 1rem;">Verify your email to start using Post Room</h1>
        <a href=${activateUrl} target="_blank" style="background-color: #0072dd; font-size: 14px; color: #ffffff; font-weight: 600; border-radius: 0.5rem; padding: 0.75rem; text-decoration: none;">
          Verify Your Email
        </a>
        <div style="margin-top: 5rem;">
          <h2 style="font-size: 14px; margin-bottom: 1rem;">If you can't see the button, Use this link instead:</h2>
          <a href=${activateUrl} target="_blank" style="color: #0072dd;">${activateUrl}</a>
        </div>
      </div>
      `,
    });

    const token = await generateToken(newUser.id);

    res.setHeader("Authorization", `Bearer ${token}`);

    return res.status(201).json(newUser);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Authenticate a user
// @route   POST /api/login
// @access  Public
export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send("Missing required fields");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(422).send("Invalid email format");
    }

    const user = await db.user.findFirst({
      where: {
        email,
      },
    });

    if (!user) {
      return res.status(400).send("Incorrect email or password");
    }

    if (user.provider != "DEFAULT" || !user.hashedPassword) {
      return res.status(400).send("Account signed up using a provider");
    }

    const passwordMatch = await bcrypt.compare(password, user.hashedPassword);

    if (!passwordMatch) {
      return res.status(400).send("Incorrect email or password");
    }

    const token = await generateToken(user.id);

    res.setHeader("Authorization", `Bearer ${token}`);

    return res.status(200).json({
      id: user.id,
      fullname: user.fullname,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Add categories to user
// @route   POST /api/user/category
// @access  Private
export const addCategories = async (req: Request, res: Response) => {
  try {
    const { categories } = req.body as { categories: string[] };

    if (!categories) {
      return res.status(400).send("No categories provided");
    }

    const dbCategories = [];
    for (let i = 0; i < categories.length; i++) {
      const category = await db.category.findFirst({
        where: {
          name: categories[i],
        },
      });

      if (!category) {
        continue;
      }

      dbCategories.push(category);

      const userAlreadyHasCategory = await db.categoryOnUsers.findFirst({
        where: {
          categoryId: category.id,
          userId: req.user.id,
        },
      });

      if (userAlreadyHasCategory) {
        continue;
      }

      await db.categoryOnUsers.create({
        data: {
          categoryId: category.id,
          userId: req.user.id,
        },
      });
    }

    return res.status(200).json(dbCategories);
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Get user data
// @route   GET /api/me
// @access  Private
export const getUser = async (req: Request, res: Response) => {
  try {
    const { id, imageUrl, fullname, username, email, createdAt, updatedAt } = req?.user;

    return res.status(200).json({
      id,
      imageUrl,
      fullname,
      username,
      email,
      createdAt,
      updatedAt,
    });
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Send an account delete email confirmation
// @route   DELETE /api/user
// @access  Private
export const sendAccountDeleteEmail = async (req: Request, res: Response) => {
  try {
    const { id, email } = req?.user;

    const deleteTokenString =
      crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

    const deleteToken = await db.deleteToken.create({
      data: {
        userId: id,
        token: deleteTokenString,
      },
    });

    const confirmDeletionUrl = `http://localhost:3000/delete-account/${deleteToken.token}`;

    await sendMail({
      subject: "Account delete confirmation for Post Room account",
      email: email,
      html: `
      <div>
        <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 1rem;">Delete your Post Room account</h1>
        <a href=${confirmDeletionUrl} target="_blank" style="background-color: #ff2020; font-size: 14px; color: #ffffff; font-weight: 600; border-radius: 0.5rem; padding: 0.75rem; text-decoration: none;">
          Delete Your Account
        </a>
        <h1 style="color: #ff2020; font-size: 32px; margin-top: 1rem;">Warning this action is irreversible!</h1>
        <div style="margin-top: 5rem;">
          <h2 style="font-size: 14px; margin-bottom: 1rem;">If you can't see the button, Use this link instead:</h2>
          <a href=${confirmDeletionUrl} target="_blank" style="color: #0072dd;">${confirmDeletionUrl}</a>
        </div>
        <p style="margin-top: 1rem;">This link will expire in 24 hours</p>
      </div>
      `,
    });

    return res.status(200).send("email sent");
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};

// @desc    Delete an account using deletion token
// @route   DELETE /api/user/:token
// @access  Private
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req?.user;

    const token = req.params.token as string;

    const deleteToken = await db.deleteToken.findUnique({
      where: {
        token,
      },
    });

    if (!deleteToken) {
      return res.status(404).send("Token not found");
    }

    if (deleteToken.createdAt < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      return res.status(400).send("Token is expired");
    }

    if (deleteToken.userId != id) {
      return res.status(403).send("Forbidden");
    }

    await db.user.delete({
      where: {
        id: deleteToken.userId,
      },
    });

    return res.status(200).send({ message: "account deleted" });
  } catch (error: any) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
};
// Generate JWT
const generateToken = async (id: number) => {
  return await jwt.sign({ id }, process.env.JWT_SECRET!, {
    expiresIn: "30d",
  });
};
