import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/User'
import { UserDocument } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: UserDocument;
    }
  }
}

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1]

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string)

      req.user = await User.findById(decoded.id).select('-password') as UserDocument

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' })
      }

      next()
    } catch (error) {
      console.error(error)
      res.status(401).json({ message: 'Not authorized, token failed' })
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' })
  }
}

export const admin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === 'admin') {
    next()
  } else {
    res.status(403).json({ message: 'Not authorized as an admin' })
  }
}

export const delivery = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === 'delivery') {
    next()
  } else {
    res.status(403).json({ message: 'Not authorized as a delivery person' })
  }
}