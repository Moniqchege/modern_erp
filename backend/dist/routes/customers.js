"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.customersRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const server_1 = require("../server");
exports.customersRouter = (0, express_1.Router)();
const CreateCustomerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    email: zod_1.z.string().email("Invalid email format").optional().nullable(),
    phone: zod_1.z.string().max(20).optional().nullable(),
    address: zod_1.z.string().max(500).optional().nullable(),
});
// GET all customers
exports.customersRouter.get("/", async (_req, res) => {
    try {
        const customers = await server_1.prisma.customer.findMany({
            orderBy: { createdAt: "desc" },
        });
        res.status(200).json({ customers });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch customers", error: String(error) });
    }
});
// POST a new customer
exports.customersRouter.post("/", async (req, res) => {
    try {
        const parse = CreateCustomerSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                message: "Invalid request body",
                errors: parse.error.flatten(),
            });
        }
        const input = parse.data;
        // Check if email already exists if provided
        if (input.email) {
            const existing = await server_1.prisma.customer.findUnique({
                where: { email: input.email },
            });
            if (existing) {
                return res.status(400).json({
                    message: "A customer with this email already exists",
                });
            }
        }
        const customer = await server_1.prisma.customer.create({
            data: {
                name: input.name,
                email: input.email,
                phone: input.phone,
                address: input.address,
            },
        });
        res.status(201).json({ customer });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to create customer", error: String(error) });
    }
});
