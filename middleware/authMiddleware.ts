import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import db from "../lib/db";

interface JWTPayload {
  id: number;
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

      // Get user from the token
      const user = await db.user.findUnique({
        where: {
          id: decoded.id,
        },
        select: {
          id: true,
          fullname: true,
          username: true,
          imageUrl: true,
          bio: true,
          email: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        return res.status(401).send("Unauthorized");
      }

      req.user = user;

      next();
    } catch (error: any) {
      return res.status(401).send("Unauthorized");
    }
  }

  if (!token) {
    return res.status(401).send("Unauthorized, no token");
  }
};
