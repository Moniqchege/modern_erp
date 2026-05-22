import { Navigate, useParams } from "react-router-dom";
import { ROUTES } from "./routes";

const RESERVED = new Set(["catalogue", "production", "packaging", "reports", "new"]);

export function LegacyInventoryItemRedirect() {
  const { itemId } = useParams<{ itemId: string }>();
  if (!itemId || RESERVED.has(itemId)) return <Navigate to={ROUTES.INVENTORY} replace />;
  return <Navigate to={ROUTES.INVENTORY_DETAIL(itemId)} replace />;
}

export function LegacyInventoryItemEditRedirect() {
  const { itemId } = useParams<{ itemId: string }>();
  if (!itemId) return <Navigate to={ROUTES.INVENTORY_CATALOGUE} replace />;
  return <Navigate to={ROUTES.INVENTORY_EDIT(itemId)} replace />;
}
