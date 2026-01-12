import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

export const login = async (req: Request, res: Response) => {
    const { username, password } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { username },
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role, forceChangePassword: user.forceChangePassword },
            JWT_SECRET,
            { expiresIn: '100y' } // Token effectively never expires
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                forceChangePassword: user.forceChangePassword,
            },
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const changePassword = async (req: Request, res: Response) => {
    // Middleware should verify token and attach user to req
    const { userId, newPassword } = req.body; // In real implementation, get userId from token

    // Simple implementation for now (Refine with middleware later)
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedPassword,
                forceChangePassword: false
            }
        });

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Could not update password' });
    }
};
