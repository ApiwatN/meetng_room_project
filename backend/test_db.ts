import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    console.log("--- Testing datasourceUrl ---");
    try {
        const p1 = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL } as any);
        await p1.$connect();
        console.log("Success: datasourceUrl");
        await p1.$disconnect();
        return;
    } catch (e: any) { console.log("Failed:", e.message); }

    console.log("--- Testing url ---");
    try {
        const p2 = new PrismaClient({ url: process.env.DATABASE_URL } as any);
        await p2.$connect();
        console.log("Success: url");
        await p2.$disconnect();
        return;
    } catch (e: any) { console.log("Failed:", e.message); }

    console.log("--- Testing datasources (singular) ---");
    try {
        const p3 = new PrismaClient({
            datasources: { db: { url: process.env.DATABASE_URL } }
        } as any);
        await p3.$connect();
        console.log("Success: datasources");
        await p3.$disconnect();
        return;
    } catch (e: any) { console.log("Failed:", e.message); }
}

test();
