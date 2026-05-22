import { prisma } from "../server";
import { getInventoryAlertRecipients, sendEmail } from "./notification.service";

/**
 * Send reorder alert when stock crosses at or below reorderLevel.
 */
export async function checkReorderAlert(
  itemId: string,
  previousQuantity?: number
): Promise<void> {
  const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item || item.reorderLevel == null) return;

  const reorderLevel = Number(item.reorderLevel);
  const currentQty = Number(item.quantity);
  const prevQty = previousQuantity ?? currentQty;

  const wasAbove = prevQty > reorderLevel;
  const isAtOrBelow = currentQty <= reorderLevel;

  if (!isAtOrBelow) return;
  if (!wasAbove && prevQty <= reorderLevel) return;

  const recipients = getInventoryAlertRecipients();
  const subject = `[ERP] Low stock: ${item.sku} — ${item.name}`;
  const text = [
    `Stock has reached the reorder level.`,
    ``,
    `SKU: ${item.sku}`,
    `Item: ${item.name}`,
    `Current quantity: ${currentQty.toFixed(3)} ${item.unit}`,
    `Reorder level: ${reorderLevel.toFixed(3)} ${item.unit}`,
    item.reorderQuantity != null
      ? `Suggested reorder qty: ${Number(item.reorderQuantity).toFixed(3)} ${item.unit}`
      : "",
    ``,
    `Time: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  await sendEmail({ to: recipients, subject, text });
}
