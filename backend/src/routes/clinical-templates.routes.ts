import { Router } from 'express';

import { authenticate } from '../middleware/auth.middleware';
import { validateRequest, body, param, query } from '../middleware/validation.middleware';
import { clinicalTemplatesService } from '../services/clinical-templates.service';

const router = Router();

// All template routes require authentication
router.use(authenticate);

// Get all templates
router.get(
  '/',
  [
    query('category').optional().isString(),
    query('specialty').optional().isString(),
    query('search').optional().isString(),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { category, specialty, search } = req.query;

      let templates;
      if (search) {
        templates = clinicalTemplatesService.searchTemplates(search as string);
      } else if (category) {
        templates = clinicalTemplatesService.getTemplatesByCategory(category as string);
      } else if (specialty) {
        templates = clinicalTemplatesService.getTemplatesBySpecialty(specialty as string);
      } else {
        templates = clinicalTemplatesService.getAllTemplates();
      }

      res.json({
        templates,
        total: templates.length
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve templates'
      });
    }
  }
);

// Get template by ID
router.get(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid template ID'),
    validateRequest
  ],
  async (req, res) => {
    try {
      const template = clinicalTemplatesService.getTemplateById(req.params.id);
      
      if (!template) {
        res.status(404).json({
          error: 'Template not found'
        });
        return;
      }

      res.json(template);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve template'
      });
    }
  }
);

// Create custom template
router.post(
  '/',
  [
    body('name').isString().notEmpty().withMessage('Template name is required'),
    body('category').isString().notEmpty().withMessage('Category is required'),
    body('content').isString().notEmpty().withMessage('Content is required'),
    body('tags').isArray().withMessage('Tags must be an array'),
    body('specialty').optional().isString(),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { name, category, content, tags, specialty } = req.body;
      const userId = req.user?.id || 'unknown';

      const template = clinicalTemplatesService.createTemplate(
        name,
        category,
        content,
        tags,
        userId,
        specialty
      );

      res.status(201).json(template);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to create template'
      });
    }
  }
);

// Update template
router.put(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid template ID'),
    body('name').optional().isString().notEmpty(),
    body('category').optional().isString().notEmpty(),
    body('content').optional().isString().notEmpty(),
    body('tags').optional().isArray(),
    body('specialty').optional().isString(),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { name, category, content, tags, specialty } = req.body;
      
      const updatedTemplate = clinicalTemplatesService.updateTemplate(
        req.params.id,
        { name, category, content, tags, specialty }
      );

      if (!updatedTemplate) {
        res.status(404).json({
          error: 'Template not found or is a system template'
        });
        return;
      }

      res.json(updatedTemplate);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to update template'
      });
    }
  }
);

// Delete template
router.delete(
  '/:id',
  [
    param('id').isUUID().withMessage('Invalid template ID'),
    validateRequest
  ],
  async (req, res) => {
    try {
      const success = clinicalTemplatesService.deleteTemplate(req.params.id);
      
      if (!success) {
        res.status(404).json({
          error: 'Template not found or is a system template'
        });
        return;
      }

      res.status(204).send();
    } catch (error) {
      res.status(500).json({
        error: 'Failed to delete template'
      });
    }
  }
);

// Apply template with variables
router.post(
  '/:id/apply',
  [
    param('id').isUUID().withMessage('Invalid template ID'),
    body('variables').isObject().withMessage('Variables must be an object'),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { variables } = req.body;
      
      const content = clinicalTemplatesService.applyTemplate(
        req.params.id,
        variables
      );

      if (!content) {
        res.status(404).json({
          error: 'Template not found'
        });
        return;
      }

      res.json({ content });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to apply template'
      });
    }
  }
);

// Get template categories
router.get(
  '/meta/categories',
  async (req, res) => {
    try {
      const categories = clinicalTemplatesService.getCategories();
      res.json({ categories });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve categories'
      });
    }
  }
);

// Get template specialties
router.get(
  '/meta/specialties',
  async (req, res) => {
    try {
      const specialties = clinicalTemplatesService.getSpecialties();
      res.json({ specialties });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve specialties'
      });
    }
  }
);

// Export templates
router.post(
  '/export',
  [
    body('templateIds').optional().isArray(),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { templateIds } = req.body;
      const templates = clinicalTemplatesService.exportTemplates(templateIds);
      
      res.json({
        templates,
        exported: templates.length
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to export templates'
      });
    }
  }
);

// Import templates
router.post(
  '/import',
  [
    body('templates').isArray().withMessage('Templates must be an array'),
    body('overwrite').optional().isBoolean(),
    validateRequest
  ],
  async (req, res) => {
    try {
      const { templates, overwrite = false } = req.body;
      const imported = clinicalTemplatesService.importTemplates(templates, overwrite);
      
      res.json({
        imported,
        message: `Successfully imported ${imported} templates`
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to import templates'
      });
    }
  }
);

export { router as clinicalTemplatesRoutes };