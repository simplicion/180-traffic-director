import { prisma, requestContext } from '@workspace/db';
import { CreateTrafficRuleDTO, UpdateTrafficRuleDTO } from '../types';

const db = prisma as any;

export class TrafficRulesService {
  private static resolveUserId(providedUserId?: string): string | undefined {
    return providedUserId || requestContext.getStore()?.userId;
  }

  static async getRulesByLinkId(userId: string | undefined, linkId: string) {
    const effectiveUserId = this.resolveUserId(userId);
    const where: any = { id: linkId };
    if (effectiveUserId) {
      where.userId = effectiveUserId;
    }

    const link = await db.trafficLink.findFirst({ where });

    if (!link) {
      throw new Error('Traffic link not found or unauthorized');
    }

    const rules = await db.trafficRule.findMany({
      where: { linkId },
      orderBy: { priority: 'asc' },
      take: 100
    });

    return { rules };
  }

  static async createRule(userId: string | undefined, data: CreateTrafficRuleDTO) {
    const effectiveUserId = this.resolveUserId(userId);
    const where: any = { id: data.linkId };
    if (effectiveUserId) {
      where.userId = effectiveUserId;
    }

    const link = await db.trafficLink.findFirst({
      where,
      include: {
        rules: {
          select: { priority: true },
          orderBy: { priority: 'desc' },
          take: 1
        }
      }
    });

    if (!link) {
      throw new Error('Traffic link not found or unauthorized');
    }

    // Determine default priority if not provided
    const nextPriority = data.priority !== undefined 
      ? data.priority 
      : (link.rules[0]?.priority !== undefined ? link.rules[0].priority + 1 : 0);

    const createPayload = {
      data: {
        linkId: data.linkId,
        userId: effectiveUserId || link.userId,
        name: data.name,
        priority: nextPriority,
        destinationUrl: data.destinationUrl,
        actionType: data.actionType || 'redirect_302',
        conditions: JSON.stringify(data.conditions || []),
        weight: data.weight !== undefined ? data.weight : 100,
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    };

    let rule;
    try {
      rule = await db.trafficRule.create(createPayload);
    } catch (err: any) {
      const msg = String(err?.message || '');
      const isLegacyNullConstraint =
        err?.code === 'P2011' ||
        /null constraint violation/i.test(msg) && /(ruleType|matchMode|companyId)/i.test(msg);

      if (!isLegacyNullConstraint) {
        throw err;
      }

      // Self-heal legacy NOT NULL columns (e.g., ruleType / matchMode) in existing databases and retry once
      await db.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='TrafficRule' AND column_name='ruleType') THEN
            ALTER TABLE public."TrafficRule" ALTER COLUMN "ruleType" SET DEFAULT 'custom';
            ALTER TABLE public."TrafficRule" ALTER COLUMN "ruleType" DROP NOT NULL;
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='TrafficRule' AND column_name='matchMode') THEN
            ALTER TABLE public."TrafficRule" ALTER COLUMN "matchMode" SET DEFAULT 'match';
            ALTER TABLE public."TrafficRule" ALTER COLUMN "matchMode" DROP NOT NULL;
          END IF;
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='TrafficRule' AND column_name='companyId') THEN
            ALTER TABLE public."TrafficRule" ALTER COLUMN "companyId" DROP NOT NULL;
          END IF;
        END $$;
      `);

      rule = await db.trafficRule.create(createPayload);
    }

    return { rule };
  }

  static async updateRule(userId: string | undefined, ruleId: string, data: UpdateTrafficRuleDTO) {
    const effectiveUserId = this.resolveUserId(userId);
    const rule = await db.trafficRule.findUnique({
      where: { id: ruleId },
      include: { link: true }
    });

    if (!rule || (effectiveUserId && rule.link.userId !== effectiveUserId)) {
      throw new Error('Traffic rule not found or unauthorized');
    }

    const updated = await db.trafficRule.update({
      where: { id: ruleId },
      data: {
        name: data.name !== undefined ? data.name : undefined,
        priority: data.priority !== undefined ? data.priority : undefined,
        destinationUrl: data.destinationUrl !== undefined ? data.destinationUrl : undefined,
        actionType: data.actionType !== undefined ? data.actionType : undefined,
        conditions: data.conditions !== undefined ? JSON.stringify(data.conditions) : undefined,
        weight: data.weight !== undefined ? data.weight : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined
      }
    });

    return { rule: updated };
  }

  static async deleteRule(userId: string | undefined, ruleId: string) {
    const effectiveUserId = this.resolveUserId(userId);
    const rule = await db.trafficRule.findUnique({
      where: { id: ruleId },
      include: { link: true }
    });

    if (!rule || (effectiveUserId && rule.link.userId !== effectiveUserId)) {
      throw new Error('Traffic rule not found or unauthorized');
    }

    await db.trafficRule.delete({
      where: { id: ruleId }
    });

    return { success: true };
  }

  static async reorderRules(userId: string | undefined, linkId: string, orderedRuleIds: string[]) {
    const effectiveUserId = this.resolveUserId(userId);
    const where: any = { id: linkId };
    if (effectiveUserId) {
      where.userId = effectiveUserId;
    }

    const link = await db.trafficLink.findFirst({ where });

    if (!link) {
      throw new Error('Traffic link not found or unauthorized');
    }

    const updates = orderedRuleIds.map((ruleId, index) =>
      db.trafficRule.updateMany({
        where: { id: ruleId, linkId },
        data: { priority: index }
      })
    );

    await db.$transaction(updates);

    const rules = await db.trafficRule.findMany({
      where: { linkId },
      orderBy: { priority: 'asc' }
    });

    return { rules };
  }
}
