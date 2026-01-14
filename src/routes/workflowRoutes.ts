import { Router, Request, Response } from 'express';
import { AppDataSource } from '../data-source';
import { Workflow } from '../models/Workflow';
import { TaskStatus } from '../workers/taskRunner';

const router = Router();

// GET /workflow/:id/status - Get workflow status (Task 5)
router.get('/:id/status', async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
        const workflowRepository = AppDataSource.getRepository(Workflow);
        const workflow = await workflowRepository.findOne({
            where: { workflowId: id },
            relations: ['tasks']
        });

        if (!workflow) {
            res.status(404).json({
                error: 'Workflow not found',
                message: `No workflow found with ID: ${id}`
            });
            return;
        }

        const completedTasks = workflow.tasks.filter(t => t.status === TaskStatus.Completed).length;
        const totalTasks = workflow.tasks.length;

        res.status(200).json({
            workflowId: workflow.workflowId,
            status: workflow.status,
            completedTasks,
            totalTasks
        });
    } catch (error: any) {
        console.error('Error fetching workflow status:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch workflow status'
        });
    }
});

// GET /workflow/:id/results - Get workflow results (Task 6)
router.get('/:id/results', async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
        const workflowRepository = AppDataSource.getRepository(Workflow);
        const workflow = await workflowRepository.findOne({
            where: { workflowId: id },
            relations: ['tasks']
        });

        if (!workflow) {
            res.status(404).json({
                error: 'Workflow not found',
                message: `No workflow found with ID: ${id}`
            });
            return;
        }

        if (workflow.status !== 'completed' && workflow.status !== 'failed') {
            res.status(400).json({
                error: 'Workflow not completed',
                message: 'Workflow is still in progress. Please wait for it to complete.',
                currentStatus: workflow.status
            });
            return;
        }

        let finalResult: any = workflow.finalResult;
        if (finalResult) {
            try {
                finalResult = JSON.parse(finalResult);
            } catch {
                // Keep as string if not valid JSON
            }
        }

        res.status(200).json({
            workflowId: workflow.workflowId,
            status: workflow.status,
            finalResult
        });
    } catch (error: any) {
        console.error('Error fetching workflow results:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch workflow results'
        });
    }
});

export default router;
