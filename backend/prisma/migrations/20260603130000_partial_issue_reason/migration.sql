-- Add partialIssueReason to StockTransferItem
-- Stores the reason provided by the main store manager when qtyIssued < qtyRequested
ALTER TABLE `StockTransferItem`
  ADD COLUMN `partialIssueReason` TEXT NULL AFTER `qtyIssued`;
