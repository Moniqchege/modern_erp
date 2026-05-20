import { Router } from "express";
import { z } from "zod";
import { prisma } from "../server";

export const customersRouter = Router();

const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email("Invalid email format").optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});

type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;

// GET all customers
customersRouter.get("/", async (_req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ customers });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch customers", error: String(error) });
  }
});

// POST a new customer
customersRouter.post("/", async (req, res) => {
  try {
    const parse = CreateCustomerSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        message: "Invalid request body",
        errors: parse.error.flatten(),
      });
    }

    const input: CreateCustomerInput = parse.data;

    // Check if email already exists if provided
    if (input.email) {
      const existing = await prisma.customer.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        return res.status(400).json({
          message: "A customer with this email already exists",
        });
      }
    }

    const customer = await prisma.customer.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        address: input.address,
      },
    });

    res.status(201).json({ customer });
  } catch (error) {
    res.status(500).json({ message: "Failed to create customer", error: String(error) });
  }
});
