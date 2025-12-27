import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

export const getUsers = async (req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, username: true, role: true, section: true }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

export const createUser = async (req: Request, res: Response) => {
    const { username, password, role, section, employeeId, email, name, phoneNumber } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                employeeId: employeeId || username,
                email: email || `${username}@company.com`,
                name,
                role: role || 'USER',
                section,
                phoneNumber,
                forceChangePassword: true
            }
        });
        res.json({ id: user.id, username: user.username });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create user' });
    }
};
