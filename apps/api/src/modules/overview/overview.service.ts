import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class OverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async adminOverview() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [
      totalCustomers,
      activeCustomers,
      totalServiceNodes,
      enabledServiceNodes,
      totalServers,
      enabledServers,
      totalCards,
      unusedCards,
      enabledPaymentChannels,
      pendingOrders,
      expiredActiveCustomerNodes,
      todayPaidOrders,
      todayBalanceLogs
    ] = await this.prisma.$transaction([
      this.prisma.customer.count(),
      this.prisma.customer.count({ where: { status: 'active' } }),
      this.prisma.serviceNode.count(),
      this.prisma.serviceNode.count({ where: { enabled: true } }),
      this.prisma.xuiServer.count(),
      this.prisma.xuiServer.count({ where: { enabled: true } }),
      this.prisma.card.count(),
      this.prisma.card.count({ where: { status: 'unused' } }),
      this.prisma.paymentChannel.count({ where: { enabled: true } }),
      this.prisma.rechargeOrder.count({ where: { status: 'pending' } }),
      this.prisma.customerNode.count({ where: { status: 'active', expireAt: { lte: now } } }),
      this.prisma.rechargeOrder.aggregate({
        where: { status: 'paid', paidAt: { gte: todayStart } },
        _count: { _all: true },
        _sum: { amount: true }
      }),
      this.prisma.balanceLog.aggregate({
        where: { type: 'renewal', createdAt: { gte: todayStart } },
        _count: { _all: true },
        _sum: { amount: true }
      })
    ]);

    return {
      customers: { total: totalCustomers, active: activeCustomers },
      serviceNodes: { total: totalServiceNodes, enabled: enabledServiceNodes, expiredActive: expiredActiveCustomerNodes },
      servers: { total: totalServers, enabled: enabledServers },
      cards: { total: totalCards, unused: unusedCards },
      payments: {
        enabledChannels: enabledPaymentChannels,
        pendingOrders,
        todayPaidCount: todayPaidOrders._count._all,
        todayPaidAmount: todayPaidOrders._sum.amount || 0
      },
      renewals: {
        todayCount: todayBalanceLogs._count._all,
        todayAmount: todayBalanceLogs._sum.amount || 0
      }
    };
  }
}
