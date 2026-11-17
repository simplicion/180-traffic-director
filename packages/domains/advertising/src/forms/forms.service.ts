import { prisma, requestContext } from '@workspace/db';
import crypto from 'crypto';
import axios from 'axios';

const db = prisma as any;

export interface SalesSettings {
  isSalesActivity?: boolean;
  targetStage?: string; // 'Lead' | 'Contacted' | 'Qualified' | 'Demo' | 'Proposal'
  defaultDealValue?: number;
  assignedSalesRepId?: string;
  autoCreateActivity?: boolean;
  tagLabel?: string;
}

export interface FormPage {
  id: string; // e.g., "page_1", "page_2"
  title: string; // e.g., "Step 1: Basic Information"
  description?: string; // e.g., "Tell us about yourself"
  order: number; // 0, 1, 2...
}

export interface FormSettings {
  buttonColor?: string;
  buttonTextColor?: string;
  submitButtonText?: string;
  backgroundColor?: string;
  backgroundType?: 'color' | 'image' | 'default';
  backgroundImage?: string;
  redirectUrl?: string;
  pixelEventName?: string; // e.g. "Lead", "CompleteRegistration", "CustomEvent"
  webhookUrl?: string;
  notificationEmails?: string[];
  customCss?: string;
  successMessage?: string;
  showCompanyLogo?: boolean;
  salesSettings?: SalesSettings;
  isSalesActivity?: boolean;
  allowedDomains?: string[]; // Origin whitelist for Headless Endpoints
  honeypotField?: string; // Custom honeypot field name (e.g. "_gotcha")
  isHeadless?: boolean; // Headless data capture endpoint mode
  pages?: FormPage[]; // Multi-step / Multi-page form sections
  disallowDuplicateSubmissions?: boolean;
  defaultCountryCode?: string;
}

export class FormsService {
  private static formCache: Map<string, { form: any; cachedAt: number }> = new Map();

  private static resolveUserId(providedUserId?: string): string | undefined {
    return providedUserId || requestContext.getStore()?.userId;
  }

  public static invalidateFormCache(identifier?: string) {
    if (identifier) {
      this.formCache.delete(identifier);
      for (const [key, val] of this.formCache.entries()) {
        if (val.form?.id === identifier || val.form?.slug === identifier || val.form?.formCode === identifier) {
          this.formCache.delete(key);
        }
      }
    } else {
      this.formCache.clear();
    }
  }

  public static async getCachedOrFetchForm(identifier: string) {
    const cached = this.formCache.get(identifier);
    if (cached && Date.now() - cached.cachedAt < 60000) {
      return cached.form;
    }

    const form = await db.form.findFirst({
      where: {
        OR: [{ slug: identifier }, { formCode: identifier }, { id: identifier }]
      },
      include: { fields: true }
    });

    if (form) {
      const entry = { form, cachedAt: Date.now() };
      this.formCache.set(identifier, entry);
      if (form.formCode) this.formCache.set(form.formCode, entry);
      if (form.slug) this.formCache.set(form.slug, entry);
      if (form.id) this.formCache.set(form.id, entry);
    }

    return form;
  }

  private static generateApiKey(): string {
    return `fkey_${crypto.randomBytes(20).toString('hex')}`;
  }

  public static generate10CharId(): string {
    const chars = '23456789abcdefghjkmnpqrstuvwxyz';
    let result = '';
    const bytes = crypto.randomBytes(10);
    for (let i = 0; i < 10; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }

  public static normalizeKey(key: string): string {
    return String(key || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  public static readonly FIELD_ALIASES: Record<string, string[]> = {
    name: ['name', 'fullname', 'full_name', 'yourname', 'your_name', 'clientname', 'client_name', 'customername', 'customer_name', 'contactname', 'contact_name', 'first_name', 'last_name', 'fname', 'lname'],
    phone: ['phone', 'phonenumber', 'phone_number', 'mobile', 'mobilenumber', 'mobile_number', 'tel', 'whatsapp', 'yourphone', 'your_phone', 'cell', 'contactnumber', 'contact_number'],
    email: ['email', 'useremail', 'user_email', 'workemail', 'work_email', 'youremail', 'your_email', 'emailaddress', 'email_address'],
    company: ['company', 'companyname', 'company_name', 'organization', 'organizationname', 'organization_name', 'businessname', 'business_name'],
    message: ['message', 'comments', 'comment', 'notes', 'note', 'inquiry', 'details', 'description', 'requirement', 'requirements'],
    budget: ['budget', 'dealvalue', 'deal_value', 'amount', 'price', 'cost', 'quantity']
  };

  public static resolveFieldValueFromObject(field: any, values: Record<string, any>): any {
    if (!values || typeof values !== 'object') return '';

    if (values[field.id] !== undefined && values[field.id] !== null && values[field.id] !== '') return values[field.id];
    if (field.mapping && values[field.mapping] !== undefined && values[field.mapping] !== null && values[field.mapping] !== '') return values[field.mapping];
    if (field.name && values[field.name] !== undefined && values[field.name] !== null && values[field.name] !== '') return values[field.name];
    if (values[field.label] !== undefined && values[field.label] !== null && values[field.label] !== '') return values[field.label];

    const keys = Object.keys(values);
    if (keys.length === 0) return '';

    const fieldMappingNorm = field.mapping ? FormsService.normalizeKey(field.mapping) : '';
    const fieldNameNorm = field.name ? FormsService.normalizeKey(field.name) : '';
    const fieldLabelNorm = field.label ? FormsService.normalizeKey(field.label) : '';

    for (const key of keys) {
      const val = values[key];
      if (val === undefined || val === null || val === '') continue;

      const normKey = FormsService.normalizeKey(key);
      if (
        (fieldMappingNorm && normKey === fieldMappingNorm) ||
        (fieldNameNorm && normKey === fieldNameNorm) ||
        (fieldLabelNorm && normKey === fieldLabelNorm)
      ) {
        return val;
      }
    }

    const fieldType = (field.type || '').toUpperCase();
    const fieldTag = `${field.mapping || ''} ${field.label || ''} ${field.name || ''}`.toLowerCase();

    let targetCategory: string | null = null;
    if (fieldType === 'EMAIL' || fieldTag.includes('email')) targetCategory = 'email';
    else if (fieldType === 'PHONE' || fieldTag.includes('phone') || fieldTag.includes('mobile') || fieldTag.includes('tel')) targetCategory = 'phone';
    else if (fieldTag.includes('company') || fieldTag.includes('org')) targetCategory = 'company';
    else if (fieldTag.includes('name')) targetCategory = 'name';
    else if (fieldTag.includes('message') || fieldTag.includes('note') || fieldTag.includes('comment') || fieldTag.includes('inquiry')) targetCategory = 'message';
    else if (fieldType === 'NUMBER' || fieldTag.includes('budget') || fieldTag.includes('amount') || fieldTag.includes('price')) targetCategory = 'budget';

    if (targetCategory && FormsService.FIELD_ALIASES[targetCategory]) {
      const aliases = FormsService.FIELD_ALIASES[targetCategory].map((a) => FormsService.normalizeKey(a));
      for (const key of keys) {
        const val = values[key];
        if (val === undefined || val === null || val === '') continue;
        const normKey = FormsService.normalizeKey(key);
        if (aliases.includes(normKey)) {
          return val;
        }
      }
    }

    return '';
  }

  static async createForm(data: {
    title: string;
    description?: string;
    fields?: any[];
    userId?: string;
    companyId?: string;
    formType?: 'GENERAL_SURVEY' | 'SALES_ACTIVITY' | 'HEADLESS_ENDPOINT';
    formCode?: string;
    slug?: string;
    settings?: FormSettings;
  }) {
    const { title, description, fields, formType, formCode, settings } = data;
    const effectiveUserId = this.resolveUserId(data.userId);
    if (!effectiveUserId) {
      throw new Error('Authentication required to create a form');
    }

    let resolvedFormCode = formCode && formCode.length === 10 ? formCode : this.generate10CharId();
    let slug = data.slug || resolvedFormCode;

    const existing = await db.form.findUnique({ where: { slug } });
    if (existing) {
      resolvedFormCode = this.generate10CharId();
      slug = resolvedFormCode;
    }

    const apiKey = this.generateApiKey();
    const resolvedFormType =
      formType ||
      (settings?.isHeadless
        ? 'HEADLESS_ENDPOINT'
        : settings?.isSalesActivity || settings?.salesSettings?.isSalesActivity
        ? 'SALES_ACTIVITY'
        : 'GENERAL_SURVEY');

    const form = await db.form.create({
      data: {
        userId: effectiveUserId,
        companyId: data.companyId || null,
        title,
        description: description || null,
        slug,
        apiKey,
        formType: resolvedFormType,
        formCode: resolvedFormCode,
        settings: (settings || {}) as any,
        fields: {
          create: (fields || []).map((field, index) => ({
            label: field.label || 'Untitled Field',
            type: field.type || 'TEXT',
            required: field.required || false,
            placeholder: field.placeholder || null,
            description: field.description || null,
            options: field.options || null,
            validation: {
              ...(typeof field.validation === 'object' && field.validation !== null ? field.validation : {}),
              pageId: field.pageId || field.validation?.pageId || 'page_1'
            },
            order: index,
            mapping: field.mapping || null
          }))
        }
      },
      include: {
        fields: {
          orderBy: { order: 'asc' }
        }
      }
    });

    return form;
  }

  static async getForms(userId?: string) {
    const effectiveUserId = this.resolveUserId(userId);
    const where: any = effectiveUserId ? { userId: effectiveUserId } : {};

    const forms = await db.form.findMany({
      where,
      include: {
        _count: {
          select: { submissions: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return forms.map((f: any) => {
      const submissions = f._count?.submissions || 0;
      const views = f.viewsCount || 0;
      const conversionRate = views > 0 ? Number(((submissions / views) * 100).toFixed(1)) : 0;
      return {
        ...f,
        conversionRate,
        apiKey: f.apiKey || null
      };
    });
  }

  static async getFormById(id: string, userId?: string) {
    const effectiveUserId = this.resolveUserId(userId);
    const where: any = {
      OR: [{ id }, { slug: id }, { formCode: id }],
      ...(effectiveUserId ? { userId: effectiveUserId } : {})
    };

    const form = await db.form.findFirst({
      where,
      include: {
        fields: {
          orderBy: { order: 'asc' }
        },
        _count: {
          select: { submissions: true }
        }
      }
    });

    if (!form) {
      throw new Error('No form found with that ID');
    }

    let needsUpdate = false;
    const updateData: any = {};

    if (!form.apiKey) {
      updateData.apiKey = this.generateApiKey();
      form.apiKey = updateData.apiKey;
      needsUpdate = true;
    }

    if (!form.formCode || form.formCode.length !== 10) {
      updateData.formCode = this.generate10CharId();
      form.formCode = updateData.formCode;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await db.form.update({
        where: { id: form.id },
        data: updateData
      });
    }

    const submissions = form._count?.submissions || 0;
    const views = form.viewsCount || 0;
    const conversionRate = views > 0 ? Number(((submissions / views) * 100).toFixed(1)) : 0;

    const mappedFields = form.fields.map((f: any) => ({
      ...f,
      pageId: (f.validation as any)?.pageId || (f.options as any)?.pageId || 'page_1'
    }));

    return {
      ...form,
      fields: mappedFields,
      conversionRate
    };
  }

  static async updateForm(
    id: string,
    data: {
      title?: string;
      description?: string;
      isActive?: boolean;
      formType?: 'GENERAL_SURVEY' | 'SALES_ACTIVITY' | 'HEADLESS_ENDPOINT';
      formCode?: string;
      fields?: any[];
      settings?: FormSettings;
    },
    userId?: string
  ) {
    const { title, description, isActive, formType, formCode, fields, settings } = data;
    const effectiveUserId = this.resolveUserId(userId);

    const existingForm = await db.form.findFirst({
      where: {
        OR: [{ id }, { slug: id }, { formCode: id }],
        ...(effectiveUserId ? { userId: effectiveUserId } : {})
      }
    });

    if (!existingForm) {
      throw new Error('No form found with that ID');
    }

    const targetId = existingForm.id;

    const updatedForm = await db.$transaction(async (tx: any) => {
      if (fields) {
        const existingFields = await tx.formField.findMany({
          where: { formId: targetId }
        });
        const existingFieldMap = new Map(existingFields.map((f: any) => [f.id, f]));
        const incomingFieldIds = new Set(fields.map((f: any) => f.id).filter(Boolean));

        const fieldsToDelete = existingFields.filter((f: any) => !incomingFieldIds.has(f.id));
        if (fieldsToDelete.length > 0) {
          await tx.formField.deleteMany({
            where: { id: { in: fieldsToDelete.map((f: any) => f.id) } }
          });
        }

        for (let index = 0; index < fields.length; index++) {
          const field = fields[index];
          const fieldData = {
            label: field.label || 'Untitled Field',
            type: field.type || 'TEXT',
            required: field.required || false,
            placeholder: field.placeholder || null,
            description: field.description || null,
            options: field.options || null,
            validation: {
              ...(typeof field.validation === 'object' && field.validation !== null ? field.validation : {}),
              pageId: field.pageId || field.validation?.pageId || 'page_1'
            },
            order: index,
            mapping: field.mapping || null
          };

          if (field.id && existingFieldMap.has(field.id)) {
            await tx.formField.update({
              where: { id: field.id },
              data: fieldData
            });
          } else {
            await tx.formField.create({
              data: {
                ...(field.id && field.id.length > 10 ? { id: field.id } : {}),
                formId: targetId,
                ...fieldData
              }
            });
          }
        }
      }

      return await tx.form.update({
        where: { id: targetId },
        data: {
          title: title !== undefined ? title : undefined,
          description: description !== undefined ? description : undefined,
          isActive: isActive !== undefined ? isActive : undefined,
          formType: formType !== undefined ? formType : undefined,
          formCode: formCode !== undefined ? formCode : undefined,
          settings: settings !== undefined ? (settings as any) : undefined
        },
        include: {
          fields: {
            orderBy: { order: 'asc' }
          }
        }
      });
    });

    this.invalidateFormCache(targetId);
    if (updatedForm.slug) this.invalidateFormCache(updatedForm.slug);
    if (updatedForm.formCode) this.invalidateFormCache(updatedForm.formCode);

    return {
      ...updatedForm,
      fields: updatedForm.fields.map((f: any) => ({
        ...f,
        pageId: (f.validation as any)?.pageId || (f.options as any)?.pageId || 'page_1'
      }))
    };
  }

  static async regenerateApiKey(id: string, userId?: string) {
    const effectiveUserId = this.resolveUserId(userId);
    const form = await db.form.findFirst({
      where: {
        OR: [{ id }, { slug: id }, { formCode: id }],
        ...(effectiveUserId ? { userId: effectiveUserId } : {})
      }
    });
    if (!form) {
      throw new Error('No form found with that ID');
    }

    const newApiKey = this.generateApiKey();
    const updated = await db.form.update({
      where: { id: form.id },
      data: { apiKey: newApiKey },
      select: { id: true, apiKey: true }
    });
    this.invalidateFormCache(form.id);
    return updated.apiKey;
  }

  static async deleteForm(id: string, userId?: string) {
    const effectiveUserId = this.resolveUserId(userId);
    const form = await db.form.findFirst({
      where: {
        OR: [{ id }, { slug: id }, { formCode: id }],
        ...(effectiveUserId ? { userId: effectiveUserId } : {})
      }
    });

    if (!form) {
      throw new Error('No form found with that ID');
    }

    await db.form.delete({
      where: { id: form.id }
    });

    this.invalidateFormCache(form.id);
    return true;
  }

  static async deleteSubmissions(submissionIds: string[], userId?: string) {
    if (!submissionIds || submissionIds.length === 0) return { deletedCount: 0, deletedLeadsCount: 0 };

    const effectiveUserId = this.resolveUserId(userId);
    const submissions = await db.formSubmission.findMany({
      where: {
        id: { in: submissionIds },
        ...(effectiveUserId ? { form: { userId: effectiveUserId } } : {})
      },
      select: { id: true }
    });

    if (submissions.length === 0) return { deletedCount: 0, deletedLeadsCount: 0 };
    const subIds = submissions.map((s: any) => s.id);

    await db.formSubmissionValue.deleteMany({
      where: { submissionId: { in: subIds } }
    });

    const subDeleteResult = await db.formSubmission.deleteMany({
      where: { id: { in: subIds } }
    });

    return {
      deletedCount: subDeleteResult.count,
      deletedLeadsCount: 0
    };
  }

  static async deleteSubmission(submissionId: string, userId?: string) {
    const res = await this.deleteSubmissions([submissionId], userId);
    if (res.deletedCount === 0) {
      throw new Error('Submission not found');
    }
    return res;
  }

  static async deleteAllSubmissions(formId: string, userId?: string) {
    const effectiveUserId = this.resolveUserId(userId);
    const form = await db.form.findFirst({
      where: {
        OR: [{ id: formId }, { slug: formId }, { formCode: formId }],
        ...(effectiveUserId ? { userId: effectiveUserId } : {})
      }
    });

    if (!form) {
      throw new Error('No form found with that ID');
    }

    const allSubs = await db.formSubmission.findMany({
      where: { formId: form.id },
      select: { id: true }
    });

    if (allSubs.length === 0) return { deletedCount: 0, deletedLeadsCount: 0 };

    return await this.deleteSubmissions(
      allSubs.map((s: any) => s.id),
      effectiveUserId
    );
  }

  static async getFormSubmissions(id: string, userId?: string) {
    const effectiveUserId = this.resolveUserId(userId);
    const form = await db.form.findFirst({
      where: {
        OR: [{ id }, { slug: id }, { formCode: id }],
        ...(effectiveUserId ? { userId: effectiveUserId } : {})
      }
    });

    if (!form) {
      throw new Error('No form found with that ID');
    }

    const submissions = await db.formSubmission.findMany({
      where: { formId: form.id },
      include: {
        values: {
          include: {
            field: true
          }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    return submissions.map((sub: any) => ({
      ...sub,
      status: sub.status || 'new',
      lead: null
    }));
  }

  static async updateSubmissionStatus(submissionId: string, status: string, userId?: string) {
    const effectiveUserId = this.resolveUserId(userId);
    const submission = await db.formSubmission.findFirst({
      where: {
        id: submissionId,
        ...(effectiveUserId ? { form: { userId: effectiveUserId } } : {})
      }
    });

    if (!submission) {
      throw new Error('Submission not found');
    }

    await db.formSubmission.update({
      where: { id: submission.id },
      data: { status }
    });

    return {
      submissionId: submission.id,
      leadId: submission.leadId || null,
      status,
      lead: null
    };
  }

  static async exportSubmissionsCsv(id: string, userId?: string): Promise<{ filename: string; csv: string }> {
    const effectiveUserId = this.resolveUserId(userId);
    const form = await db.form.findFirst({
      where: {
        OR: [{ id }, { slug: id }, { formCode: id }],
        ...(effectiveUserId ? { userId: effectiveUserId } : {})
      },
      include: {
        fields: { orderBy: { order: 'asc' } }
      }
    });

    if (!form) throw new Error('No form found with that ID');

    const submissions = await db.formSubmission.findMany({
      where: { formId: form.id },
      include: {
        values: {
          include: { field: true }
        }
      },
      orderBy: { submittedAt: 'desc' }
    });

    const fieldHeaders = form.fields.map((f: any) => f.label.replace(/"/g, '""'));
    const headers = ['Submission ID', 'Date & Time', 'Status', ...fieldHeaders, 'IP Address', 'Referrer'];

    const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = submissions.map((sub: any) => {
      const fieldValues = form.fields.map((f: any) => {
        const match = sub.values.find((v: any) => v.fieldId === f.id);
        if (!match) return '';
        if (match.fileUrl) return `${match.fileName || 'File'}: ${match.fileUrl}`;
        return match.value || '';
      });

      return [
        escapeCsv(sub.id),
        escapeCsv(new Date(sub.submittedAt).toISOString()),
        escapeCsv(sub.status || 'new'),
        ...fieldValues.map(escapeCsv),
        escapeCsv(sub.ipAddress || ''),
        escapeCsv(sub.referrer || '')
      ].join(',');
    });

    const csvContent = [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const cleanTitle = form.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `${cleanTitle}_submissions_${Date.now()}.csv`;

    return { filename, csv: csvContent };
  }

  // ─── External REST API for Custom CRMs ───────────────────────────────────

  static async getFormSubmissionsByApiKey(
    formIdOrSlug: string,
    apiKey: string,
    options?: { page?: number; limit?: number; since?: string }
  ) {
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('fkey_')) {
      throw new Error('Invalid or missing API key');
    }

    const form = await db.form.findFirst({
      where: {
        OR: [{ id: formIdOrSlug }, { slug: formIdOrSlug }, { formCode: formIdOrSlug }],
        apiKey
      },
      include: {
        fields: { orderBy: { order: 'asc' } }
      }
    });

    if (!form) {
      throw new Error('Unauthorized: Invalid API key for this form');
    }

    const page = Math.max(1, Number(options?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options?.limit) || 20));
    const skip = (page - 1) * limit;

    const whereClause: any = { formId: form.id };
    if (options?.since) {
      whereClause.submittedAt = { gte: new Date(options.since) };
    }

    const [total, rawSubmissions] = await Promise.all([
      db.formSubmission.count({ where: whereClause }),
      db.formSubmission.findMany({
        where: whereClause,
        include: {
          values: {
            include: { field: true }
          }
        },
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit
      })
    ]);

    const formattedSubmissions = rawSubmissions.map((sub: any) => {
      const data: Record<string, any> = {};
      sub.values.forEach((v: any) => {
        const key = v.field.mapping || v.field.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
        data[key] = v.fileUrl ? { url: v.fileUrl, name: v.fileName, text: v.value } : v.value;
      });

      return {
        id: sub.id,
        status: sub.status || 'new',
        submittedAt: sub.submittedAt,
        ipAddress: sub.ipAddress,
        referrer: sub.referrer,
        data
      };
    });

    return {
      form: {
        id: form.id,
        title: form.title,
        slug: form.slug,
        formCode: form.formCode,
        formType: form.formType
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      submissions: formattedSubmissions
    };
  }

  // ─── Public Methods for Form Submissions & Views ──────────────────────────

  static async getFormBySlug(slug: string, isViewEvent: boolean = false) {
    const form = await db.form.findFirst({
      where: {
        OR: [{ slug }, { formCode: slug }, { id: slug }]
      },
      include: {
        fields: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!form) {
      throw new Error('Form not found');
    }

    if (!form.isActive) {
      throw new Error('This form is currently inactive');
    }

    if (isViewEvent) {
      db.form
        .update({
          where: { id: form.id },
          data: { viewsCount: { increment: 1 } }
        })
        .catch((err: any) => console.error('Failed to increment form views:', err));
    }

    const mappedFields = form.fields.map((f: any) => ({
      ...f,
      pageId: (f.validation as any)?.pageId || (f.options as any)?.pageId || 'page_1'
    }));

    return {
      ...form,
      fields: mappedFields
    };
  }

  static async submitForm(
    slug: string,
    values: Record<string, any>,
    meta?: { ipAddress?: string; userAgent?: string; referrer?: string }
  ) {
    if (!values || typeof values !== 'object') {
      throw new Error('Invalid submission format');
    }

    const form = await db.form.findFirst({
      where: {
        OR: [{ slug }, { formCode: slug }, { id: slug }]
      },
      include: { fields: true }
    });

    if (!form) throw new Error('Form not found');
    if (!form.isActive) throw new Error('This form is currently inactive');

    const resolveFieldValue = (field: any) => FormsService.resolveFieldValueFromObject(field, values);

    const missingFields: string[] = [];
    form.fields.forEach((field: any) => {
      if (field.required && !['HEADING', 'PARAGRAPH', 'DIVIDER'].includes(field.type)) {
        const val = resolveFieldValue(field);
        if (val === undefined || val === null || val === '') {
          missingFields.push(field.label);
        }
      }
    });

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    const leadData: Record<string, any> = {
      email: '',
      name: '',
      phone: '',
      company: '',
      budget: 0,
      source: `Web Form: ${form.title} (${form.formCode || form.id})`
    };

    form.fields.forEach((field: any) => {
      const val = resolveFieldValue(field);
      if (val === undefined || val === null || val === '') return;

      const strVal = typeof val === 'object' ? (val.name ? `${val.name} (${val.url})` : JSON.stringify(val)) : String(val);

      if (field.type === 'EMAIL' || field.mapping?.toLowerCase().includes('email') || field.label.toLowerCase().includes('email')) {
        leadData.email = leadData.email || strVal;
      } else if (field.type === 'PHONE' || field.mapping?.toLowerCase().includes('phone') || field.label.toLowerCase().includes('phone')) {
        leadData.phone = leadData.phone || strVal;
      } else if (field.mapping?.toLowerCase().includes('company') || field.label.toLowerCase().includes('company')) {
        leadData.company = leadData.company || strVal;
      } else if (field.type === 'NUMBER' && (field.label.toLowerCase().includes('budget') || field.mapping?.toLowerCase().includes('budget') || field.label.toLowerCase().includes('amount'))) {
        leadData.budget = Number(strVal) || 0;
      } else if (field.mapping?.toLowerCase().includes('name') || field.label.toLowerCase().includes('name')) {
        leadData.name = leadData.name ? `${leadData.name} ${strVal}` : strVal;
      }
    });

    const settings = (form.settings as FormSettings) || {};

    if (leadData.email) {
      const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailPattern.test(leadData.email.trim())) {
        throw new Error('Please enter a valid email address (e.g. user@gmail.com)');
      }
    }

    if (leadData.phone) {
      const digitsOnly = leadData.phone.replace(/\D/g, '');
      if (digitsOnly.length < 10) {
        throw new Error('Please enter a valid 10-digit phone number');
      }
    }

    if (settings.disallowDuplicateSubmissions && (leadData.email || leadData.phone)) {
      const duplicateConditions: any[] = [];
      if (leadData.email) {
        duplicateConditions.push({
          value: { equals: leadData.email.trim(), mode: 'insensitive' as const }
        });
      }
      if (leadData.phone) {
        const phoneDigits = leadData.phone.replace(/\D/g, '');
        const last10 = phoneDigits.slice(-10);
        duplicateConditions.push({ value: { equals: leadData.phone.trim() } });
        if (last10.length >= 7) {
          duplicateConditions.push({ value: { contains: last10 } });
          if (last10.length === 10) {
            duplicateConditions.push({ value: { contains: `${last10.slice(0, 5)} ${last10.slice(5)}` } });
            duplicateConditions.push({ value: { contains: `${last10.slice(0, 3)} ${last10.slice(3, 6)} ${last10.slice(6)}` } });
          }
        }
      }

      const existingSubmissionValue = await db.formSubmissionValue.findFirst({
        where: {
          submission: { formId: form.id },
          OR: duplicateConditions
        },
        select: { id: true }
      });

      if (existingSubmissionValue) {
        throw new Error('A submission with this contact information (phone number or email) already exists. Multiple submissions are not allowed for this form.');
      }
    }

    const submissionValues = form.fields
      .filter((f: any) => !['HEADING', 'PARAGRAPH', 'DIVIDER'].includes(f.type))
      .map((field: any) => {
        const val = resolveFieldValue(field);
        let fileUrl: string | null = null;
        let fileName: string | null = null;
        let textValue = '';

        if (typeof val === 'object' && val !== null && val.url) {
          fileUrl = val.url;
          fileName = val.name || 'attachment';
          textValue = val.url;
        } else if (Array.isArray(val)) {
          textValue = val.join(', ');
        } else {
          textValue = String(val ?? '');
        }

        return {
          fieldId: field.id,
          value: textValue,
          fileUrl,
          fileName
        };
      });

    const submission = await db.formSubmission.create({
      data: {
        formId: form.id,
        userId: form.userId,
        companyId: form.companyId || null,
        status: 'new',
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        referrer: meta?.referrer || null,
        values: {
          create: submissionValues
        }
      },
      select: {
        id: true,
        submittedAt: true
      }
    });

    // Non-blocking outbound webhook dispatch
    if (settings.webhookUrl && typeof settings.webhookUrl === 'string' && settings.webhookUrl.startsWith('http')) {
      const salesSettings = settings.salesSettings || {};
      const isSalesForm = form.formType === 'SALES_ACTIVITY' || settings.isSalesActivity === true || salesSettings.isSalesActivity === true;
      const webhookPayload = {
        event: 'form.submitted',
        formId: form.id,
        formCode: form.formCode || form.id,
        formType: form.formType,
        isSalesActivity: isSalesForm,
        formTitle: form.title,
        submissionId: submission.id,
        submittedAt: submission.submittedAt,
        lead: leadData,
        answers: submissionValues,
        meta: {
          ipAddress: meta?.ipAddress || null,
          userAgent: meta?.userAgent || null,
          referrer: meta?.referrer || null
        }
      };

      setImmediate(() => {
        axios
          .post(settings.webhookUrl!, webhookPayload, {
            headers: {
              'Content-Type': 'application/json',
              'X-180workspace-Event': 'form.submitted',
              'X-180workspace-Form-Id': form.id
            },
            timeout: 5000
          })
          .catch((err: any) => {
            console.warn(`[Webhook Error] Failed to post form submission to ${settings.webhookUrl}:`, err?.message || err);
          });
      });
    }

    return {
      success: true,
      submissionId: submission.id,
      successMessage: settings.successMessage || 'Thank you! Your submission has been received.',
      redirectUrl: settings.redirectUrl || null,
      pixelEventName: settings.pixelEventName || 'Lead'
    };
  }

  public static flattenPayload(obj: any, prefix = ''): Record<string, any> {
    const result: Record<string, any> = {};
    if (!obj || typeof obj !== 'object') return result;

    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('_')) continue;

      const newKey = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        Object.assign(result, this.flattenPayload(value, newKey));
      } else if (Array.isArray(value)) {
        result[newKey] = value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
      } else {
        result[newKey] = value;
      }
    }
    return result;
  }

  public static inferFieldType(key: string, value: any): string {
    const lowerKey = key.toLowerCase();
    const strVal = String(value || '').trim();

    if (lowerKey.includes('email') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) return 'EMAIL';
    if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('tel') || lowerKey.includes('whatsapp') || /^(\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}$/.test(strVal)) {
      return 'PHONE';
    }
    if (
      typeof value === 'number' ||
      lowerKey.includes('budget') ||
      lowerKey.includes('price') ||
      lowerKey.includes('amount') ||
      lowerKey.includes('cost') ||
      lowerKey.includes('quantity') ||
      lowerKey.includes('deal_value') ||
      lowerKey.includes('dealvalue')
    ) {
      return 'NUMBER';
    }
    if (lowerKey.includes('date') || lowerKey.includes('dob') || lowerKey.includes('birthday') || (/^\d{4}-\d{2}-\d{2}/.test(strVal) && !isNaN(Date.parse(strVal)))) {
      return 'DATE';
    }
    if (
      strVal.length > 120 ||
      lowerKey.includes('message') ||
      lowerKey.includes('description') ||
      lowerKey.includes('notes') ||
      lowerKey.includes('comment') ||
      lowerKey.includes('bio') ||
      lowerKey.includes('inquiry') ||
      lowerKey.includes('requirement')
    ) {
      return 'TEXTAREA';
    }
    if (typeof value === 'boolean' || strVal === 'true' || strVal === 'false') return 'CHECKBOX';

    return 'TEXT';
  }

  public static humanizeKey(key: string): string {
    return key
      .replace(/[._\-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();
  }

  static async ingestHeadlessSubmission(
    identifier: string,
    rawPayload: any,
    meta?: {
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
      origin?: string;
    }
  ) {
    if (!rawPayload || typeof rawPayload !== 'object') {
      throw new Error('Invalid submission payload format');
    }

    const form = await this.getCachedOrFetchForm(identifier);

    if (!form) throw new Error('Endpoint not found');
    if (!form.isActive) throw new Error('This endpoint is currently inactive');

    const settings = (form.settings as FormSettings) || {};

    const honeypotKeys = ['_gotcha', '_honey', '_bot_check', 'honey_pot', 'spam_check'];
    if (settings.honeypotField) honeypotKeys.push(settings.honeypotField);
    const honeypotTriggered = honeypotKeys.some((k) => {
      const v = rawPayload[k];
      return v !== undefined && v !== null && String(v).trim() !== '';
    });

    if (honeypotTriggered) {
      return {
        success: true,
        quarantined: true,
        submissionId: 'quarantined-bot-submission',
        formCode: form.formCode || form.id,
        dealId: null,
        redirectUrl: null,
        pixelEventName: settings.pixelEventName || 'Lead',
        successMessage: 'Submission received successfully'
      };
    }

    const allowedDomains = settings.allowedDomains || [];
    if (allowedDomains.length > 0) {
      const incomingOrigin =
        meta?.origin ||
        (meta?.referrer
          ? (() => {
              try {
                return new URL(meta.referrer).origin;
              } catch {
                return '';
              }
            })()
          : '');

      if (incomingOrigin) {
        const isAllowed = allowedDomains.some((domain) => {
          const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
          const cleanIncoming = incomingOrigin.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
          return cleanIncoming === cleanDomain || cleanIncoming.endsWith('.' + cleanDomain);
        });

        if (!isAllowed) {
          throw new Error(`Domain origin '${incomingOrigin}' is not authorized to submit to this endpoint`);
        }
      }
    }

    const flattened = this.flattenPayload(rawPayload);
    const discoveredFieldKeys = Object.keys(flattened);

    const currentFields = [...(form.fields || [])];
    const nextOrder = currentFields.length;

    const unmappedKeys = discoveredFieldKeys.filter((key) => {
      const isAlreadyMapped = currentFields.some((f) => {
        const val = FormsService.resolveFieldValueFromObject(f, { [key]: flattened[key] });
        return val !== undefined && val !== null && val !== '';
      });
      return !isAlreadyMapped;
    });

    if (unmappedKeys.length > 0) {
      const createdFields = await Promise.all(
        unmappedKeys.map((key, idx) => {
          const inferredType = this.inferFieldType(key, flattened[key]);
          const humanLabel = this.humanizeKey(key);
          return db.formField
            .create({
              data: {
                formId: form.id,
                label: humanLabel,
                type: inferredType,
                mapping: key,
                required: false,
                order: nextOrder + idx
              }
            })
            .catch(() => null);
        })
      );
      createdFields.filter(Boolean).forEach((f: any) => {
        currentFields.push(f);
        if (!form.fields.some((ef: any) => ef.id === f.id)) {
          form.fields.push(f);
        }
      });
      this.invalidateFormCache(form.id);
      this.formCache.set(identifier, { form, cachedAt: Date.now() });
    }

    const leadData: Record<string, any> = {
      email: '',
      name: '',
      phone: '',
      company: '',
      budget: 0,
      source: `Website Capture: ${form.title} (#${form.formCode || form.id})`
    };

    currentFields.forEach((field) => {
      const val = FormsService.resolveFieldValueFromObject(field, flattened);
      if (val === undefined || val === null || val === '') return;
      const strVal = String(val).trim();
      const mappingLower = (field.mapping || '').toLowerCase();
      const labelLower = field.label.toLowerCase();

      if (field.type === 'EMAIL' || mappingLower.includes('email') || labelLower.includes('email')) {
        leadData.email = leadData.email || strVal;
      } else if (field.type === 'PHONE' || mappingLower.includes('phone') || mappingLower.includes('mobile') || labelLower.includes('phone') || labelLower.includes('mobile')) {
        leadData.phone = leadData.phone || strVal;
      } else if (mappingLower.includes('company') || mappingLower.includes('organization') || labelLower.includes('company')) {
        leadData.company = leadData.company || strVal;
      } else if (field.type === 'NUMBER' || mappingLower.includes('budget') || mappingLower.includes('price') || mappingLower.includes('amount') || labelLower.includes('budget')) {
        const num = parseFloat(strVal.replace(/[^0-9.-]/g, ''));
        if (!isNaN(num)) leadData.budget = num;
      } else if (mappingLower.includes('name') || labelLower.includes('name') || mappingLower.includes('contact')) {
        leadData.name = leadData.name ? `${leadData.name} ${strVal}` : strVal;
      }
    });

    if (settings.disallowDuplicateSubmissions && (leadData.email || leadData.phone)) {
      const duplicateConditions: any[] = [];
      if (leadData.email) {
        duplicateConditions.push({ value: { equals: leadData.email.trim(), mode: 'insensitive' as const } });
      }
      if (leadData.phone) {
        const phoneDigits = leadData.phone.replace(/\D/g, '');
        const last10 = phoneDigits.slice(-10);
        duplicateConditions.push({ value: { equals: leadData.phone.trim() } });
        if (last10.length === 10) {
          duplicateConditions.push({ value: { contains: last10 } });
        }
      }

      const existingSubmissionValue = await db.formSubmissionValue.findFirst({
        where: {
          submission: { formId: form.id },
          OR: duplicateConditions
        },
        select: { id: true }
      });

      if (existingSubmissionValue) {
        throw new Error('A submission with this contact information (email or phone) already exists. Multiple submissions are not allowed.');
      }
    }

    const submissionValues = currentFields
      .filter((f: any) => !['HEADING', 'PARAGRAPH', 'DIVIDER'].includes(f.type))
      .map((field: any) => {
        const matchedVal = FormsService.resolveFieldValueFromObject(field, flattened);
        const strVal =
          matchedVal !== undefined && matchedVal !== null
            ? typeof matchedVal === 'object'
              ? JSON.stringify(matchedVal)
              : String(matchedVal)
            : '';
        return {
          fieldId: field.id,
          value: strVal,
          fileUrl: null,
          fileName: null
        };
      })
      .filter((sv) => sv.value !== '');

    const submission = await db.formSubmission.create({
      data: {
        formId: form.id,
        userId: form.userId,
        companyId: form.companyId || null,
        status: 'new',
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null,
        referrer: meta?.referrer || meta?.origin || null,
        values: {
          create: submissionValues
        }
      }
    });

    if (settings.webhookUrl && typeof settings.webhookUrl === 'string' && settings.webhookUrl.startsWith('http')) {
      const webhookPayload = {
        event: 'form.submitted',
        endpointType: 'HEADLESS_ENDPOINT',
        formId: form.id,
        formCode: form.formCode || form.id,
        formTitle: form.title,
        submissionId: submission.id,
        submittedAt: submission.submittedAt,
        lead: leadData,
        data: flattened
      };

      axios
        .post(settings.webhookUrl, webhookPayload, {
          timeout: 5000,
          headers: { 'Content-Type': 'application/json', 'User-Agent': '180workspace-Webhook/1.0' }
        })
        .catch((err: any) => {
          console.error(`Webhook delivery failed for form ${form.id} to ${settings.webhookUrl}:`, err.message);
        });
    }

    const redirectUrl = rawPayload._next || rawPayload._redirect || settings.redirectUrl || null;

    return {
      success: true,
      submissionId: submission.id,
      formCode: form.formCode || form.id,
      dealId: null,
      leadId: null,
      clientId: null,
      redirectUrl,
      pixelEventName: settings.pixelEventName || 'Lead',
      successMessage: settings.successMessage || 'Thank you! Your submission has been captured.',
      data: flattened
    };
  }
}
