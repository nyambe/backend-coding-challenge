import { Repository } from 'typeorm';
import { Task } from '../models/Task';
import { getJobForTaskType } from '../jobs/JobFactory';
import {WorkflowStatus} from "../workflows/WorkflowFactory";
import {Workflow} from "../models/Workflow";
import {Result} from "../models/Result";

export enum TaskStatus {
    Queued = 'queued',
    InProgress = 'in_progress',
    Completed = 'completed',
    Failed = 'failed'
}

export class TaskRunner {
    constructor(
        private taskRepository: Repository<Task>,
    ) {}

    /**
     * Runs the appropriate job based on the task's type, managing the task's status.
     * @param task - The task entity that determines which job to run.
     * @throws If the job fails, it rethrows the error.
     */
    async run(task: Task): Promise<void> {
        task.status = TaskStatus.InProgress;
        task.progress = 'starting job...';
        await this.taskRepository.save(task);
        const job = getJobForTaskType(task.taskType);

        try {
            console.log(`Starting job ${task.taskType} for task ${task.taskId}...`);
            const resultRepository = this.taskRepository.manager.getRepository(Result);
            const taskResult = await job.run(task);
            console.log(`Job ${task.taskType} for task ${task.taskId} completed successfully.`);
            const result = new Result();
            result.taskId = task.taskId!;
            result.data = JSON.stringify(taskResult || {});
            await resultRepository.save(result);
            task.resultId = result.resultId!;
            task.status = TaskStatus.Completed;
            task.progress = null;
            await this.taskRepository.save(task);

        } catch (error: any) {
            console.error(`Error running job ${task.taskType} for task ${task.taskId}:`, error);

            task.status = TaskStatus.Failed;
            task.progress = null;
            await this.taskRepository.save(task);

            throw error;
        }

        const workflowRepository = this.taskRepository.manager.getRepository(Workflow);
        const resultRepository = this.taskRepository.manager.getRepository(Result);
        const currentWorkflow = await workflowRepository.findOne({ where: { workflowId: task.workflow.workflowId }, relations: ['tasks'] });

        if (currentWorkflow) {
            const allCompleted = currentWorkflow.tasks.every(t => t.status === TaskStatus.Completed);
            const anyFailed = currentWorkflow.tasks.some(t => t.status === TaskStatus.Failed);

            if (anyFailed) {
                currentWorkflow.status = WorkflowStatus.Failed;
                // Aggregate results including failure info
                currentWorkflow.finalResult = await this.aggregateWorkflowResults(currentWorkflow, resultRepository);
            } else if (allCompleted) {
                currentWorkflow.status = WorkflowStatus.Completed;
                // Aggregate all task results into finalResult
                currentWorkflow.finalResult = await this.aggregateWorkflowResults(currentWorkflow, resultRepository);
            } else {
                currentWorkflow.status = WorkflowStatus.InProgress;
            }

            await workflowRepository.save(currentWorkflow);
        }
    }

    private async aggregateWorkflowResults(workflow: Workflow, resultRepository: Repository<Result>): Promise<string> {
        const taskResults: Array<{
            taskId: string;
            taskType: string;
            stepNumber: number;
            status: string;
            output?: any;
            error?: string;
        }> = [];

        for (const task of workflow.tasks) {
            const taskResult: any = {
                taskId: task.taskId,
                taskType: task.taskType,
                stepNumber: task.stepNumber,
                status: task.status
            };

            if (task.status === TaskStatus.Completed && task.resultId) {
                const result = await resultRepository.findOne({ where: { resultId: task.resultId } });
                if (result && result.data) {
                    try {
                        taskResult.output = JSON.parse(result.data);
                    } catch {
                        taskResult.output = result.data;
                    }
                }
            } else if (task.status === TaskStatus.Failed) {
                taskResult.error = 'Task execution failed';
            }

            taskResults.push(taskResult);
        }

        // Sort by stepNumber
        taskResults.sort((a, b) => a.stepNumber - b.stepNumber);

        const finalResult = {
            workflowId: workflow.workflowId,
            clientId: workflow.clientId,
            status: workflow.status,
            completedAt: new Date().toISOString(),
            tasks: taskResults
        };

        return JSON.stringify(finalResult);
    }
}