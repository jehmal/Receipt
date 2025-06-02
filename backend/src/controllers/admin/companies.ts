import { FastifyRequest, FastifyReply } from 'fastify';
import { getCompanies, getCompanyById, updateCompany, updateCompanyStatus, deleteCompany } from '@/services/company';
import { logUserAction } from '@/services/audit';
import { logger } from '@/utils/logger';

interface CompanyQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

interface CompanyStatusUpdate {
  status: string;
  reason?: string;
}

export const adminCompaniesController = {
  async getCompanies(
    request: FastifyRequest<{ Querystring: CompanyQueryParams }>,
    reply: FastifyReply
  ) {
    try {
      const { page = 1, limit = 20, search, status } = request.query;

      const companies = await getCompanies({
        page,
        limit,
        search,
        status,
        includeInactive: true,
        includeStats: true
      });

      return reply.send({
        success: true,
        data: companies.data,
        pagination: {
          page,
          limit,
          total: companies.total,
          totalPages: Math.ceil(companies.total / limit)
        }
      });
    } catch (error) {
      logger.error('Error getting companies:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get companies'
      });
    }
  },

  async getCompanyById(
    request: FastifyRequest<{ Params: { companyId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { companyId } = request.params;

      const company = await getCompanyById(companyId);

      if (!company) {
        return reply.status(404).send({
          success: false,
          error: 'Company not found'
        });
      }

      return reply.send({
        success: true,
        data: company
      });
    } catch (error) {
      logger.error('Error getting company by ID:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get company'
      });
    }
  },

  async updateCompanyStatus(
    request: FastifyRequest<{ 
      Params: { companyId: string }; 
      Body: CompanyStatusUpdate 
    }>,
    reply: FastifyReply
  ) {
    try {
      const { companyId } = request.params;
      const { status, reason } = request.body;
      const adminUser = request.user;

      const company = await getCompanyById(companyId);
      if (!company) {
        return reply.status(404).send({
          success: false,
          error: 'Company not found'
        });
      }

      const updatedCompany = await updateCompanyStatus(companyId, status, reason);

      // Log the action for audit trail
      await logUserAction(
        'adminUser.id', // TODO: get actual admin user ID from request
        'company_id', // TODO: get actual company ID from request
        'company_status_update',
        'company',
        companyId,
        {
          previousStatus: company.subscription_status,
          newStatus: status,
          reason
        },
        request
      );

      return reply.send({
        success: true,
        data: updatedCompany
      });
    } catch (error) {
      logger.error('Error updating company status:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update company status'
      });
    }
  }
};