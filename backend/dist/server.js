"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const app_1 = require("./app");
exports.prisma = new client_1.PrismaClient();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app_1.app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`ERP backend listening on port ${PORT}`);
});
