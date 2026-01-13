import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { Workflow } from '../models/Workflow';
import { TaskStatus } from '../workers/taskRunner';
import { WorkflowStatus } from '../workflows/WorkflowFactory';

const router = Router();

// GET /workflow/:id/status - Get workflow status and task progress
router.get('/:id/status', async (req, res) => {
    const workflowId = req.params.id;
    const workflowRepository = AppDataSource.getRepository(Workflow);

    try {
        const workflow = await workflowRepository.findOne({
            where: { workflowId },
            relations: ['tasks']
        });

        if (!workflow) {
            return res.status(404).json({ message: 'Workflow not found' });
        }

        const completedTasks = workflow.tasks.filter(
            t => t.status === TaskStatus.Completed
        ).length;

        return res.json({
            workflowId: workflow.workflowId,
            status: workflow.status,
            completedTasks,
            totalTasks: workflow.tasks.length
        });
    } catch (error) {
        console.error('Error fetching workflow status:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// GET /workflow/:id/results - Get final workflow results
router.get('/:id/results', async (req, res) => {
    const workflowId = req.params.id;
    const workflowRepository = AppDataSource.getRepository(Workflow);

    try {
        const workflow = await workflowRepository.findOne({
            where: { workflowId }
        });

        if (!workflow) {
            return res.status(404).json({ message: 'Workflow not found' });
        }

        if (workflow.status !== WorkflowStatus.Completed) {
            return res.status(400).json({
                message: 'Workflow is not yet completed',
                currentStatus: workflow.status
            });
        }

        return res.json({
            workflowId: workflow.workflowId,
            status: workflow.status,
            finalResult: workflow.finalResult ? JSON.parse(workflow.finalResult) : null
        });
    } catch (error) {
        console.error('Error fetching workflow results:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
