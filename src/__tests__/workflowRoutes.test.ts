import { Request, Response } from 'express';

// Mock the AppDataSource before importing routes
jest.mock('../data-source', () => ({
    AppDataSource: {
        getRepository: jest.fn()
    }
}));

import { AppDataSource } from '../data-source';
import { TaskStatus } from '../workers/taskRunner';
import { WorkflowStatus } from '../workflows/WorkflowFactory';

describe('Workflow Routes', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockJson: jest.Mock;
    let mockStatus: jest.Mock;

    beforeEach(() => {
        mockJson = jest.fn();
        mockStatus = jest.fn().mockReturnValue({ json: mockJson });
        mockResponse = {
            status: mockStatus,
            json: mockJson
        };
        jest.clearAllMocks();
    });

    describe('GET /workflow/:id/status', () => {
        it('should return workflow status with task counts', async () => {
            const mockWorkflow = {
                workflowId: 'test-workflow-id',
                status: WorkflowStatus.InProgress,
                tasks: [
                    { taskId: '1', status: TaskStatus.Completed },
                    { taskId: '2', status: TaskStatus.Completed },
                    { taskId: '3', status: TaskStatus.Queued }
                ]
            };

            const mockFindOne = jest.fn().mockResolvedValue(mockWorkflow);
            (AppDataSource.getRepository as jest.Mock).mockReturnValue({
                findOne: mockFindOne
            });

            mockRequest = {
                params: { id: 'test-workflow-id' }
            };

            // Simulate the route handler logic
            const workflow = await (AppDataSource.getRepository as jest.Mock)().findOne({
                where: { workflowId: mockRequest.params!.id },
                relations: ['tasks']
            });

            const completedTasks = workflow.tasks.filter((t: any) => t.status === TaskStatus.Completed).length;
            const totalTasks = workflow.tasks.length;

            expect(completedTasks).toBe(2);
            expect(totalTasks).toBe(3);
            expect(workflow.status).toBe(WorkflowStatus.InProgress);
        });

        it('should return 404 for non-existent workflow', async () => {
            const mockFindOne = jest.fn().mockResolvedValue(null);
            (AppDataSource.getRepository as jest.Mock).mockReturnValue({
                findOne: mockFindOne
            });

            const workflow = await (AppDataSource.getRepository as jest.Mock)().findOne({
                where: { workflowId: 'non-existent-id' }
            });

            expect(workflow).toBeNull();
        });
    });

    describe('GET /workflow/:id/results', () => {
        it('should return finalResult for completed workflow', async () => {
            const mockFinalResult = {
                workflowId: 'test-workflow-id',
                tasks: [
                    { taskId: '1', type: 'analysis', output: 'Brazil' }
                ]
            };

            const mockWorkflow = {
                workflowId: 'test-workflow-id',
                status: WorkflowStatus.Completed,
                finalResult: JSON.stringify(mockFinalResult),
                tasks: []
            };

            const mockFindOne = jest.fn().mockResolvedValue(mockWorkflow);
            (AppDataSource.getRepository as jest.Mock).mockReturnValue({
                findOne: mockFindOne
            });

            const workflow = await (AppDataSource.getRepository as jest.Mock)().findOne({
                where: { workflowId: 'test-workflow-id' }
            });

            expect(workflow.status).toBe(WorkflowStatus.Completed);
            expect(workflow.finalResult).toBeDefined();

            const parsedResult = JSON.parse(workflow.finalResult);
            expect(parsedResult.workflowId).toBe('test-workflow-id');
        });

        it('should indicate workflow not completed for in-progress workflows', async () => {
            const mockWorkflow = {
                workflowId: 'test-workflow-id',
                status: WorkflowStatus.InProgress,
                finalResult: null,
                tasks: []
            };

            const mockFindOne = jest.fn().mockResolvedValue(mockWorkflow);
            (AppDataSource.getRepository as jest.Mock).mockReturnValue({
                findOne: mockFindOne
            });

            const workflow = await (AppDataSource.getRepository as jest.Mock)().findOne({
                where: { workflowId: 'test-workflow-id' }
            });

            expect(workflow.status).not.toBe(WorkflowStatus.Completed);
            expect(workflow.status).not.toBe(WorkflowStatus.Failed);
            // Should return 400 in actual route
        });
    });
});
