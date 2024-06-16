import * as express from "express";

declare global {
  namespace Express {
    interface Request {
      user: {
        id: number;
        imageUrl?: string | null;
        fullname?: string | null;
        username?: string | null;
        bio?: string | null;
        email: string;
        isEmailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  }
}
