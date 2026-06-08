import { Request, Response, NextFunction } from 'express';
import { WeighbridgeService } from '../services/weighbridge.service';
import { CancelTicketDto, CaptureSecondWeightDto, CompleteOthersTicketDto, CreateOthersTicketDto, CreatePurchaseTicketDto, CreateSaleTicketDto, WeighbridgeDashboardQuery, WeighbridgeTicketFilters } from '../types/weighbridge';


function ok(res: Response, data: unknown, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function fail(res: Response, err: unknown, statusCode = 400) {
  const message = err instanceof Error ? err.message : String(err);
  return res.status(statusCode).json({ success: false, error: message });
}

export class WeighbridgeController {
  constructor(private readonly service: WeighbridgeService) {}
  
  createPurchaseTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto: CreatePurchaseTicketDto = req.body;

      if (!dto.supplierName?.trim()) return fail(res, 'supplierName is required');
      if (!dto.vehiclePlate?.trim()) return fail(res, 'vehiclePlate is required');
      if (!dto.driverName?.trim()) return fail(res, 'driverName is required');
      if (dto.firstWeightKg == null || isNaN(Number(dto.firstWeightKg)) || Number(dto.firstWeightKg) <= 0) {
        return fail(res, 'firstWeightKg must be a positive number');
      }

      dto.operatorName = (req as any).user?.name ?? dto.operatorName;
      const ticket = await this.service.createPurchaseTicket(dto);
      return ok(res, ticket, 201);
    } catch (err) {
      next(err);
    }
  };

  createSaleTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto: CreateSaleTicketDto = req.body;

      if (!dto.customerName?.trim()) return fail(res, 'customerName is required');
      if (!dto.truckMasterId?.trim()) return fail(res, 'truckMasterId is required');
      if (dto.firstWeightKg == null || isNaN(Number(dto.firstWeightKg)) || Number(dto.firstWeightKg) <= 0) {
        return fail(res, 'firstWeightKg must be a positive number');
      }

      dto.operatorName = (req as any).user?.name ?? dto.operatorName;
      const ticket = await this.service.createSaleTicket(dto);
      return ok(res, ticket, 201);
    } catch (err) {
      next(err);
    }
  };

  createOthersTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto: CreateOthersTicketDto = req.body;

      if (!dto.customerName?.trim()) return fail(res, 'customerName is required');
      if (!dto.vehiclePlate?.trim()) return fail(res, 'vehiclePlate is required');
      if (!dto.driverName?.trim()) return fail(res, 'driverName is required');
      if (!dto.serviceDescription?.trim()) return fail(res, 'serviceDescription is required');
      if (dto.firstWeightKg == null || isNaN(Number(dto.firstWeightKg)) || Number(dto.firstWeightKg) <= 0) {
        return fail(res, 'firstWeightKg must be a positive number');
      }

      dto.operatorName = (req as any).user?.name ?? dto.operatorName;
      const ticket = await this.service.createOthersTicket(dto);
      return ok(res, ticket, 201);
    } catch (err) {
      next(err);
    }
  };

  captureSecondWeight = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const dto: CaptureSecondWeightDto = req.body;

      if (!id) return fail(res, 'Ticket id is required');
      if (dto.secondWeightKg == null || isNaN(Number(dto.secondWeightKg)) || Number(dto.secondWeightKg) <= 0) {
        return fail(res, 'secondWeightKg must be a positive number');
      }

      const ticket = await this.service.captureSecondWeight(id, dto);
      return ok(res, ticket);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) return fail(res, err.message, 404);
      next(err);
    }
  };

  completeOthersTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const dto: CompleteOthersTicketDto = req.body;

      if (!id) return fail(res, 'Ticket id is required');
      if (dto.secondWeightKg == null || isNaN(Number(dto.secondWeightKg)) || Number(dto.secondWeightKg) <= 0) {
        return fail(res, 'secondWeightKg must be a positive number');
      }
      if (!dto.paymentMethod) return fail(res, 'paymentMethod is required');
      if (dto.amountCharged == null || isNaN(Number(dto.amountCharged)) || Number(dto.amountCharged) < 0) {
        return fail(res, 'amountCharged must be a non-negative number');
      }

      const ticket = await this.service.completeOthersTicket(id, dto);
      return ok(res, ticket);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) return fail(res, err.message, 404);
      next(err);
    }
  };

  cancelTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const dto: CancelTicketDto = req.body;

      if (!id) return fail(res, 'Ticket id is required');
      if (!dto.reason?.trim()) return fail(res, 'Cancellation reason is required');

      dto.cancelledByUserId = (req as any).user?.id ?? dto.cancelledByUserId;
      const ticket = await this.service.cancelTicket(id, dto);
      return ok(res, ticket);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) return fail(res, err.message, 404);
      next(err);
    }
  };


  getTicketById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticket = await this.service.getTicketById(req.params.id);
      return ok(res, ticket);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) return fail(res, err.message, 404);
      next(err);
    }
  };

  listTickets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string>;
      const filters: WeighbridgeTicketFilters = {
        status: q.status as any,
        type: q.type as any,
        vehiclePlate: q.vehiclePlate,
        dateFrom: q.dateFrom,
        dateTo: q.dateTo,
        isManual: q.isManual !== undefined ? q.isManual === 'true' : undefined,
        page: q.page ? parseInt(q.page, 10) : 1,
        limit: q.limit ? parseInt(q.limit, 10) : 25,
      };
      const result = await this.service.listTickets(filters);
      return ok(res, result);
    } catch (err) {
      next(err);
    }
  };

 
  listPendingTickets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tickets = await this.service.listPendingTickets();
      return ok(res, tickets);
    } catch (err) {
      next(err);
    }
  };

  getDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string>;
      const query: WeighbridgeDashboardQuery = {
        dateFrom: q.dateFrom,
        dateTo: q.dateTo,
      };
      const data = await this.service.getDashboard(query);
      return ok(res, data);
    } catch (err) {
      next(err);
    }
  };

  listTrucks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const trucks = await this.service.listTrucks();
      return ok(res, trucks);
    } catch (err) {
      next(err);
    }
  };


  assignDriver = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { driverName } = req.body;

      if (!driverName?.trim()) return fail(res, 'driverName is required');

      const truck = await this.service.assignDriver(id, driverName);
      return ok(res, truck);
    } catch (err) {
      if (err instanceof Error && err.message.includes('not found')) return fail(res, err.message, 404);
      next(err);
    }
  };
}